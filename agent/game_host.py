import asyncio
import base64
import io
import json
import os
import random
from collections import OrderedDict
from typing import List

import aiohttp
import openai
from livekit import agents, api, protocol, rtc

from drawings import Line, PlayerDrawing
from prompts import PROMPTS, DifficultyLevel

NO_GUESS = "NO GUESS"

PARTICIPANT_LIMIT = 12


class GameState:
    def __init__(
        self,
        started: bool = False,
        difficulty: DifficultyLevel = "easy",
        prompt: str | None = None,
        winners: List[str] = [],
    ):
        self.started = started
        self.difficulty = difficulty
        self.prompt = prompt
        self.winners = winners

    def to_json_string(self) -> str:
        return json.dumps(self.__dict__)

    @staticmethod
    def from_json_string(json_string: str) -> "GameState":
        return GameState(**json.loads(json_string))


class GuessCache:
    def __init__(self, max_size: int = 1000):
        self._cache = OrderedDict()
        self._max_size = max_size

    def get(self, hash: str) -> str | None:
        if hash in self._cache:
            self._cache.move_to_end(hash)
            return self._cache[hash]
        return None

    def set(self, hash: str, guess: str):
        if hash in self._cache:
            self._cache.move_to_end(hash)
        else:
            if len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
        self._cache[hash] = guess


class GameHost:
    def __init__(self, ctx: agents.JobContext):
        self._ctx = ctx
        self._game_state = GameState()
        self._openai_client = openai.AsyncOpenAI()
        self._drawings = {}
        self._guess_cache = GuessCache()
        self._last_guesses = {}
        self._kick_tasks = set()
        self._used_prompts = []

    async def connect(self):
        print("Starting game host agent")
        await self._ctx.connect()
        for participant in self._ctx.room.remote_participants.values():
            if self._register_player(participant):
                await self._load_player_drawing(participant)

        self._ctx.room.local_participant.register_rpc_method(
            "host.start_game", self._start_game
        )
        self._ctx.room.local_participant.register_rpc_method(
            "host.end_game", self._end_game
        )
        self._ctx.room.local_participant.register_rpc_method(
            "host.update_difficulty", self._update_difficulty
        )

        self._ctx.room.on("data_received", self._on_data_received)
        self._ctx.room.on("participant_connected", self._on_participant_connected)
        self._ctx.room.on("participant_disconnected", self._on_participant_disconnected)

        if self._ctx.room.metadata:
            try:
                self._game_state = GameState.from_json_string(self._ctx.room.metadata)
                if self._game_state.started:
                    self._judge_task = asyncio.create_task(self._run_judge_loop())
            except Exception as e:
                print("Failed to load game state from metadata: %s" % e)

        await self._publish_game_state()

    async def _start_game(self, data: rtc.RpcInvocationData):
        if self._game_state.started:
            return json.dumps({"started": False})

        payload = json.loads(data.payload)
        
        prompt = payload.get("prompt")
        if not prompt:
            available_prompts = [p for p in PROMPTS[self._game_state.difficulty] 
                               if p not in self._used_prompts]
            if not available_prompts:
                self._used_prompts = []
                available_prompts = PROMPTS[self._game_state.difficulty]
            prompt = random.choice(available_prompts)
            self._used_prompts.append(prompt)
            
        self._last_guesses.clear()
        for player_identity, drawing in self._drawings.items():
            drawing.clear()

        self._game_state = GameState(True, self._game_state.difficulty, prompt, [])
        await self._publish_game_state()
        self._judge_task = asyncio.create_task(self._run_judge_loop())
        return json.dumps({"started": True})

    async def _end_game(self, data: rtc.RpcInvocationData):
        if not self._game_state.started:
            return json.dumps({"stopped": False})

        self._judge_task.cancel()
        self._game_state = GameState(False, self._game_state.difficulty, None, [])
        self._last_guesses.clear()
        await self._publish_game_state()
        return json.dumps({"stopped": True})

    async def _update_difficulty(self, data: rtc.RpcInvocationData):
        if self._game_state.started:
            return json.dumps({"updated": False})

        payload = json.loads(data.payload)
        difficulty = payload.get("difficulty")
        if not difficulty:
            return json.dumps({"updated": False})
        self._game_state.difficulty = difficulty
        await self._publish_game_state()
        return json.dumps({"updated": True})

    async def _run_judge_loop(self, sleep_interval: int = 1):
        print("starting judge loop")
        await asyncio.sleep(sleep_interval)
        while self._game_state.started and len(self._game_state.winners) == 0:
            print("running judge round")
            try:
                guesses = await self._make_guesses()
                if guesses == self._last_guesses:
                    print("no new guesses, skipping this round")
                    await asyncio.sleep(sleep_interval)
                    continue
                self._last_guesses = guesses
                await self._publish_guesses(guesses)
                self._game_state.winners = await self._check_winners()
                if len(self._game_state.winners) > 0:
                    self._game_state.started = False
                    self._last_guesses.clear()
                    print("found %d winners" % len(self._game_state.winners))
                await self._publish_game_state()
            except Exception as e:
                print("Failed to check winners: %s" % e)
            await asyncio.sleep(sleep_interval)

        print("exiting judge loop")

    async def _publish_game_state(self):
        async with aiohttp.ClientSession() as session:
            await api.room_service.RoomService(
                session,
                os.getenv("LIVEKIT_URL"),
                os.getenv("LIVEKIT_API_KEY"),
                os.getenv("LIVEKIT_API_SECRET"),
            ).update_room_metadata(
                protocol.room.UpdateRoomMetadataRequest(
                    room=self._ctx.room.name,
                    metadata=self._game_state.to_json_string(),
                )
            )

    def _register_player(self, participant: rtc.Participant) -> bool:
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return False

        if len(self._drawings) >= PARTICIPANT_LIMIT:
            print(
                "Reached participant limit, kicking new player %s"
                % participant.identity
            )
            kick_task = asyncio.create_task(
                self._kick_player(participant, "The room is full!")
            )
            self._kick_tasks.add(kick_task)
            kick_task.add_done_callback(self._kick_tasks.discard)
            return False

        print("Registering player %s" % participant.identity)
        self._drawings[participant.identity] = PlayerDrawing(participant.identity)
        return True

    async def _load_player_drawing(self, participant: rtc.Participant):
        if participant.identity not in self._drawings:
            return

        drawing = self._drawings[participant.identity]
        drawing_data_b64 = await self._ctx.room.local_participant.perform_rpc(
            method="player.get_drawing",
            destination_identity=participant.identity,
            payload="",
        )
        drawing_data = base64.b64decode(drawing_data_b64)
        for i in range(0, len(drawing_data), 8):
            drawing.add_line(Line.decode(drawing_data[i : i + 8]))

        print(
            "Loaded drawing for player %s with %d lines"
            % (participant.identity, len(drawing.lines))
        )

    async def _kick_player(self, participant: rtc.Participant, reason: str):
        print("Kicking player %s" % participant.identity)
        if participant.identity in self._drawings:
            del self._drawings[participant.identity]

        await self._ctx.room.local_participant.perform_rpc(
            method="player.kick",
            destination_identity=participant.identity,
            payload=json.dumps({"reason": reason}),
        )

        async with aiohttp.ClientSession() as session:
            await api.room_service.RoomService(
                session,
                os.getenv("LIVEKIT_URL"),
                os.getenv("LIVEKIT_API_KEY"),
                os.getenv("LIVEKIT_API_SECRET"),
            ).remove_participant(
                protocol.room.RoomParticipantIdentity(
                    room=self._ctx.room.name, identity=participant.identity
                )
            )

    def _unregister_player(self, participant: rtc.Participant):
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return

        print("Unregistered player %s" % participant.identity)
        if participant.identity in self._drawings:
            del self._drawings[participant.identity]

    def _on_participant_connected(self, participant: rtc.Participant):
        self._register_player(participant)

    def _on_participant_disconnected(self, participant: rtc.Participant):
        self._unregister_player(participant)

    def _on_data_received(self, data: rtc.DataPacket):
        if data.topic == "player.draw_line":
            if data.participant.identity not in self._drawings:
                return

            drawing = self._drawings[data.participant.identity]
            drawing.add_line(Line.decode(data.data))
        elif data.topic == "player.clear_drawing":
            if data.participant.identity not in self._drawings:
                return

            drawing = self._drawings[data.participant.identity]
            drawing.clear()

    async def _publish_guesses(self, guesses: dict):
        await self._ctx.room.local_participant.publish_data(
            payload=json.dumps(guesses),
            reliable=True,
            topic="host.guess",
        )

    async def _make_guess(self, player_identity: str, drawing: PlayerDrawing) -> str:
        hash = drawing.hash()
        if guess := self._guess_cache.get(hash):
            print("Found cached guess (%s) for player %s" % (guess, player_identity))
            return guess
        
        if len(drawing.lines) == 0:
            return NO_GUESS

        with io.BytesIO() as bytes_io:
            drawing.get_image().save(bytes_io, format="PNG")
            encodedImg = base64.b64encode(bytes_io.getvalue()).decode("utf-8")
        response = await self._openai_client.chat.completions.create(
            temperature=0.5,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a guesser in a realtime drawing competition. Players are drawing on a canvas. You will receive their latest drawing as an image, and can make a guess as to what it is."
                        "The drawing may be incomplete, but you can still make a guess based on what you see so far. However, don't make vague geometric guesses like 'abstract lines' or 'a circle'."
                        "You will output a single word or phrase indicating your best guess of what the drawing is of, and nothing else."
                        "If you see writing in the drawing, you must return 'CHEATER CHEATER' as this is forbidden."
                        f"If you don't have a guess at this time, such as if the drawing is empty or extremely incomplete, return '{NO_GUESS}'."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encodedImg}",
                                "detail": "low",
                            },
                        },
                        {"type": "text", "text": "Make your best guess on this image."},
                    ],
                },
            ],
            model="gpt-4o-mini",
        )
        guess = response.choices[0].message.content
        print("Made new guess (%s) for player %s" % (guess, player_identity))
        self._guess_cache.set(hash, guess)
        return guess

    async def _make_guesses(self) -> List[str]:
        return {
            player_identity: guess
            for player_identity, drawing in self._drawings.items()
            if (guess := await self._make_guess(player_identity, drawing)) != NO_GUESS
        }

    async def _check_winners(self) -> List[str]:
        response = await self._openai_client.chat.completions.create(
            temperature=0.5,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a judge in a drawing competition. Your role is to review guesses made by players, and determine if one or more of them has won the game by correctly guessing the drawing prompt."
                        "Simple synonyms or partial synonyms are fine (for instance 'ice cream' could be matched with 'ice cream cone' but not with 'ice')."
                        "Also it's fine if the guess is narrower than the prompt but not the reverse, for instance if the prompt was 'ice cream' then 'dessert' is not a valid guess, but if the prompt was 'dessert' then 'ice cream' is a valid guess."
                        "Return a JSON object with the key 'winners' containing a list of all winners, or an empty list if no player has won yet."
                    ),
                },
                {
                    "role": "user",
                    "content": "\n".join(
                        [
                            'Player "%s" guessed "%s"' % (player_identity, guess)
                            for player_identity, guess in self._last_guesses.items()
                            if guess != NO_GUESS
                        ]
                    )
                    + "\n\n"
                    + 'The current game prompt is: "%s". Please return only the list of winners.'
                    % self._game_state.prompt,
                },
            ],
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content
        print("text: %s" % text)
        winners = json.loads(text).get("winners", [])

        print(
            "Checked guesses %s and found %d winners"
            % (", ".join(self._last_guesses.values()), len(winners))
        )

        return winners
