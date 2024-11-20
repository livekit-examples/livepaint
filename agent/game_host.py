import asyncio
import base64
import io
import json
import random
from typing import List

import openai
from livekit import agents, api, rtc

from drawings import Line, PlayerDrawing
import game


# The main class for the game host agent. This instance will live for the duration of the Room
# And will maintain game state, expose an API to participants to control the game, and runs the judging loop
# Think of this as the "brain" of the game, or as a realtime stateful backend.
class GameHost:
    def __init__(self, ctx: agents.JobContext):
        self._ctx = ctx
        self._game_state = game.GameState()
        self._openai_client = openai.AsyncOpenAI()
        self._lkapi = api.LiveKitAPI()
        self._drawings = {}
        self._guess_cache = game.GuessCache()
        self._last_guesses = {}
        self._kick_tasks = set()
        self._used_prompts = []

    # Connects to the LiveKit room and sets up the environment
    async def connect(self):
        print("Starting game host agent")
        await self._ctx.connect()

        # At least one player will already be in the room when the agent arrives
        # So we'll need to register them and their drawings.
        # It is also possible for the agent to crash and rejoin later,
        # so this also achieves state restoration.
        for participant in self._ctx.room.remote_participants.values():
            if self._register_player(participant):
                await self._load_player_drawing(participant)

        # Expose a simple game API to participants via RPC
        # See https://docs.livekit.io/home/client/data/rpc/ for more details
        self._ctx.room.local_participant.register_rpc_method(
            "host.start_game", self._start_game
        )
        self._ctx.room.local_participant.register_rpc_method(
            "host.end_game", self._end_game
        )
        self._ctx.room.local_participant.register_rpc_method(
            "host.update_difficulty", self._update_difficulty
        )

        # Subscribe to events in the room
        # See https://docs.livekit.io/home/client/events/ for more details
        self._ctx.room.on("data_received", self._on_data_received)
        self._ctx.room.on("participant_connected", self._on_participant_connected)
        self._ctx.room.on("participant_disconnected", self._on_participant_disconnected)

        # Game state is stored in the Room metadata
        # We'll load this on startup in case we need to restore state
        # But typically this should be empty when the agent starts
        # See https://docs.livekit.io/home/client/data/room-metadata/ for more details
        if self._ctx.room.metadata:
            try:
                self._game_state = game.GameState.from_json_string(
                    self._ctx.room.metadata
                )
                if self._game_state.started:
                    self._judge_task = asyncio.create_task(self._run_judge_loop())
            except Exception as e:
                print("Failed to load game state from metadata: %s" % e)

        # Publish the initial game state to all participants (Room metadata)
        await self._publish_game_state()

    # This method is exposed to participants via RPC called `host.start_game`, allowing anyone to start a new game
    # It parses a `prompt` parameter from the payload, which lets participants specify a custom prompt
    # If no prompt is provided, it will choose a random one based on the current difficulty setting
    async def _start_game(self, data: rtc.RpcInvocationData):
        if self._game_state.started:
            return json.dumps({"started": False})

        # RPC payload is a string, but in this application we have adopted the convention to use JSON for all RPC payloads
        payload = json.loads(data.payload)
        prompt = payload.get("prompt")

        # If no prompt is provided, we'll choose one automatically
        if not prompt:
            available_prompts = [
                p
                for p in game.PROMPTS[self._game_state.difficulty]
                if p not in self._used_prompts
            ]
            if not available_prompts:
                self._used_prompts = []
                available_prompts = game.PROMPTS[self._game_state.difficulty]
            prompt = random.choice(available_prompts)
            self._used_prompts.append(prompt)

        # Clear guesses and drawings from previous games
        self._last_guesses.clear()
        for player_identity, drawing in self._drawings.items():
            drawing.clear()

        # Update and publish the game state to inform participants that the game has started
        self._game_state = game.GameState(True, self._game_state.difficulty, prompt, [])
        await self._publish_game_state()

        # Start the judging loop
        self._judge_task = asyncio.create_task(self._run_judge_loop())

        # Return success to the caller (using JSON by convention)
        return json.dumps({"started": True})

    # This method is exposed to participants via RPC called `host.end_game`, allowing anyone to end the current game early
    async def _end_game(self, data: rtc.RpcInvocationData):
        if not self._game_state.started:
            return json.dumps({"stopped": False})

        self._judge_task.cancel()
        self._game_state = game.GameState(False, self._game_state.difficulty, None, [])
        self._last_guesses.clear()
        await self._publish_game_state()
        return json.dumps({"stopped": True})

    # This method is exposed to participants via RPC called `host.update_difficulty`, allowing anyone to update the difficulty level
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

    # This judging loop runs when a game is in progress, and uses OpenAI to make guesses and check for winners
    async def _run_judge_loop(self, sleep_interval: int = 1):
        print("starting judge loop")

        # LiveKit Agents use [asyncio](https://docs.python.org/3/library/asyncio.html) for concurrency
        await asyncio.sleep(sleep_interval)

        # The loop will run until the game is ended (via `host.end_game`), or a winner has been found
        while self._game_state.started and len(self._game_state.winners) == 0:
            print("running judge round")
            try:
                # Make new guesses for all players' drawings
                guesses = await self._make_guesses()

                # LLM usage optimization: no need to judge the guesses if they haven't changed
                if guesses == self._last_guesses:
                    print("no new guesses, skipping this round")
                    await asyncio.sleep(sleep_interval)
                    continue
                self._last_guesses = guesses

                # Publish the guesses in realtime to all participants via data message
                await self._publish_guesses(guesses)

                # Check for winners, which may end the game
                self._game_state.winners = await self._check_winners()
                if len(self._game_state.winners) > 0:
                    self._game_state.started = False
                    self._last_guesses.clear()
                    print("found %d winners" % len(self._game_state.winners))

                # Publish the updated game state to all participants
                await self._publish_game_state()
            except Exception as e:
                print("Failed to check winners: %s" % e)

            # Wait for the next round of judging to start
            await asyncio.sleep(sleep_interval)

        print("exiting judge loop")

    # Publishes the current game state to all participants
    # We use Room metadata as it is visible and automatically synchronized to all participants.
    # Room metadata updates require a Server API package, and are authenticated with API key and secret.
    # So only the agent will be able to update it, as the frontend participants do not have the API key nor secret.
    # This is why we expose RPC methods for game control
    # See https://docs.livekit.io/home/client/data/room-metadata/ for more details
    async def _publish_game_state(self):
        await self._lkapi.room.update_room_metadata(
            api.UpdateRoomMetadataRequest(
                room=self._ctx.room.name,
                metadata=self._game_state.to_json_string(),
            )
        )

    # Registers a player, and adds their current drawing to the host's state
    def _register_player(self, participant: rtc.Participant) -> bool:
        # Don't register the Agent itself as a player
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return False

        # While LiveKit has no preset limit on the number of participants in a Room
        # The LLM-based judging loop is heavy and would require further optimization to scale to large numbers of players
        # And that's outside the scope of this example, so we'll limit it to 12 players for now
        if len(self._drawings) >= game.PARTICIPANT_LIMIT:
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

    # Loads a player's drawing into memory
    # We'll update drawings incrementally as new data messages arrive, but when a player joins or the agent restarts
    # we must load their full drawing into memory so we have a shared understanding of the current state before processing incremental updates
    # This is done with RPC exposed on the players, called `player.get_drawing`
    async def _load_player_drawing(self, participant: rtc.Participant):
        if participant.identity not in self._drawings:
            return

        drawing = self._drawings[participant.identity]

        # This RPC method uses base64 to encode raw bytes as a string, rather than JSON
        # This is more efficient for the drawing data, which can be a large collection of lines
        drawing_data_b64 = await self._ctx.room.local_participant.perform_rpc(
            method="player.get_drawing",
            destination_identity=participant.identity,
            payload="",  # no payload is needed for this method, as it takes no arguments
        )
        drawing_data = base64.b64decode(drawing_data_b64)

        # The drawing data is encoded as a series of 8-byte chunks, each representing a Line
        # See the Line class for more details on the encoding format
        for i in range(0, len(drawing_data), 8):
            drawing.add_line(Line.decode(drawing_data[i : i + 8]))

        print(
            "Loaded drawing for player %s with %d lines"
            % (participant.identity, len(drawing.lines))
        )

    # Kicks a player from the room
    # While the LiveKit Server API allows participant removal,
    # we also add an RPC method to allow the participant to remove themselves gracefully before getting forcibly removed
    async def _kick_player(self, participant: rtc.Participant, reason: str):
        print("Kicking player %s" % participant.identity)
        if participant.identity in self._drawings:
            del self._drawings[participant.identity]

        # Perform the RPC method on the participant to kick them
        # We await the response to ensure the participant has received the message and has had a chance to disconnect themselves
        await self._ctx.room.local_participant.perform_rpc(
            method="player.kick",
            destination_identity=participant.identity,
            payload=json.dumps({"reason": reason}),
        )

        # In case the participant didn't remove themselves, we'll forcibly remove them as well
        await self._lkapi.room.remove_participant(
            api.RemoveParticipantRequest(
                room=self._ctx.room.name, identity=participant.identity
            )
        )

    # Unregisters a player from the host's state, when they leave the room
    def _unregister_player(self, participant: rtc.Participant):
        # Don't treat the Agent itself as a player
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return

        print("Unregistered player %s" % participant.identity)
        if participant.identity in self._drawings:
            del self._drawings[participant.identity]

    # Event handler for `participant_connected`, which is called when a new participant joins the room
    def _on_participant_connected(self, participant: rtc.Participant):
        self._register_player(participant)

    # Event handler for `participant_disconnected`, which is called when a participant leaves the room
    def _on_participant_disconnected(self, participant: rtc.Participant):
        self._unregister_player(participant)

    # Event handler for `data_received`, which is called when a new data message arrives
    # This application uses data messages for realtime drawing updates from players as well as sharing realtime guesses from the host
    # Each data message includes a `topic`, which we will use to detemine how to parse its payload and which action to take
    # See https://docs.livekit.io/home/client/data/data-messages/ for more details
    def _on_data_received(self, data: rtc.DataPacket):
        # The `player.draw_line` topic is used to report new lines added to a player's drawing in realtime
        if data.topic == "player.draw_line":
            # We only care about messages from registered players
            if data.participant.identity not in self._drawings:
                return

            # Decode the line from the data message and add it to the player's drawing
            # We've optimized this payload to be as compact as possible, due to the high frequency of these messages
            # See the Line class for more details on the encoding format
            drawing = self._drawings[data.participant.identity]
            drawing.add_line(Line.decode(data.data))

        # The `player.clear_drawing` topic is used to clear a player's drawing (delete all the lines). No payload is needed.
        elif data.topic == "player.clear_drawing":
            # We only care about messages from registered players
            if data.participant.identity not in self._drawings:
                return

            drawing = self._drawings[data.participant.identity]
            drawing.clear()

    # Guesses are published to all participants via a data message with the `host.guess` topic
    async def _publish_guesses(self, guesses: dict):
        await self._ctx.room.local_participant.publish_data(
            payload=json.dumps(guesses),
            reliable=True,
            topic="host.guess",
        )

    # We use GPT-4o-mini with vision to make guesses based on the current state of a player's drawing.
    # Each drawing is judged independently and context-free (i.e. the LLM has no knowledge of the current prompt nor other players' drawings)
    # to control for context pollution that would degrade its guess quality
    async def _make_guess(self, player_identity: str, drawing: PlayerDrawing) -> str:
        # We use a simple cache to avoid making duplicate guesses for the same drawing (cost / speed optimization)
        hash = drawing.hash()
        if guess := self._guess_cache.get(hash):
            print("Found cached guess (%s) for player %s" % (guess, player_identity))
            return guess

        # No need to make a guess if the drawing is blank
        if len(drawing.lines) == 0:
            return game.NO_GUESS

        with io.BytesIO() as bytes_io:
            drawing.get_image().save(bytes_io, format="PNG")
            encodedImg = base64.b64encode(bytes_io.getvalue()).decode("utf-8")

        # We're using OpenAI's chat completions API via their [official Python SDK](https://github.com/openai/openai-python), as we aren't doing anything particularly complex here
        # For applications that require realtime audio streaming and conversation, you should use the [LiveKit Agents OpenAI Plugin](https://github.com/livekit/agents/tree/main/livekit-plugins/livekit-plugins-openai) instead
        response = await self._openai_client.chat.completions.create(
            temperature=0.5,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a guesser in a realtime drawing competition. Players are drawing on a canvas. You will receive their latest drawing as an image, and can make a guess as to what it is."
                        "The drawing may be incomplete, but you can still make a guess based on what you see so far. However, don't make vague geometric guesses like 'abstract lines' or 'a circle'."
                        "You will output a single word or phrase indicating your best guess of what the drawing is of, and nothing else."
                        "If you see writing in the drawing, you must return '{game.CHEATER_CHEATER}' as this is forbidden."
                        f"If you don't have a guess at this time, such as if the drawing is empty or extremely incomplete, return '{game.NO_GUESS}'."
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

        # We have a special marker for detected cheating, which will cause a special effect in the frontend, for the cheater themselves
        if guess == game.CHEATER_CHEATER:
            await self._ctx.room.local_participant.perform_rpc(
                method="player.caught_cheating",
                destination_identity=player_identity,
                payload="",
            )

        return guess

    # We use an async dictionary comprehension to make new guesses for all players
    async def _make_guesses(self) -> List[str]:
        return {
            player_identity: guess
            for player_identity, drawing in self._drawings.items()
            if (guess := await self._make_guess(player_identity, drawing))
            != game.NO_GUESS
        }

    # Winners can be checked in bulk as a single LLM call, and its possible for more than one player to win
    # We use an LLM for this step rather than a string match, because it's more flexible with synonyms and phrasing
    async def _check_winners(self) -> List[str]:
        # As above, we're using OpenAI's chat completions API via their [official Python SDK](https://github.com/openai/openai-python), as we aren't doing anything particularly complex here
        # For applications that require realtime audio streaming and conversation, you should use the [LiveKit Agents OpenAI Plugin](https://github.com/livekit/agents/tree/main/livekit-plugins/livekit-plugins-openai) instead
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
                            if guess != game.NO_GUESS
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
