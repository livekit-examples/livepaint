# LivePaint

This LiveKit example project is a realtime drawing game where players compete to complete a drawing prompt as fast as possible, while being judged by a realtime AI agent that oversees the whole game. 

It demonstrates the use of LiveKit's [realtime data messages](https://docs.livekit.io/home/client/data/messages), [room metadata](https://docs.livekit.io/home/client/data/room-metadata/), [RPC](https://docs.livekit.io/home/client/data/rpc/), [participant management](https://docs.livekit.io/home/server/managing-participants/), [token generation](https://docs.livekit.io/home/server/generating-tokens/), and [realtime audio chat](https://docs.livekit.io/home/client/tracks/) in a real-world app built on the LiveKit [JS SDK](https://github.com/livekit/client-sdk-js), [React Components](https://github.com/livekit/components-js), [Python agents SDK](https://github.com/livekit/agents), and [Python Server API](https://github.com/livekit/python-sdks).

Play live at [https://paint.livekit.io](https://paint.livekit.io)!

## Architecture

This is a short overview of how this game was built. The entire codebase is also annotated with comments that go into more detail. The `agent` directory contains the code for the realtime agent (built on [LiveKit Agents](https://docs.livekit.io/agents)). The `web` directory contains the code for the game frontend (built on [Next.js](https://nextjs.org/) with [LiveKit React Components](https://github.com/livekit/components-js)).

### Rooms & Participants

Each game is hosted in a single [LiveKit room](https://docs.livekit.io/home/client/connect) where each player is a standard participant.  The room is reused between games, so the same group of players can complete multiple games back-to-back.

Each room also contains a single [LiveKit agent](https://docs.livekit.io/agents) that handles game logic and serves as the realtime backend for the game.

A player limit of 12 is enforced by the agent, which kicks any participant joining after that limit is reached.

### Game State

Game state is stored in the [room metadata](https://docs.livekit.io/home/client/data/room-metadata/). Each player observes it and updates local UI accordingly, but only the agent is responsible for updating it.

- `game_state.started`: Whether a game is currently in progress
- `game_state.prompt`: The current drawing prompt (must be non-null if the game has started)
- `game_state.difficulty`: The difficulty of the current round
- `game_state.winners`: List of players (by identity) who won the most recent game (cleared when a new game starts)


### Drawings

Drawings are stored as an unordered set of line segments, each represented by a start point and end point. When a player clears their drawing, or a new game starts, the set is emptied.

Drawing updates are published using realtime [data messages](https://docs.livekit.io/home/client/data/messages) with the topics `player.draw_line` and `player.clear_drawing`. Drawings are stored in unit coordinates, which each point between 0 and 1 to be size-agnostic. However, when sent as a data message each segment is serialized as four 16-bit integers (representing `x1`, `y1`, `x2`, `y2`) between 0 and 65535 to minimize the message size. Each player, and the agent, reconsitutes the full drawing from these messages.

When a player joins an in-progress game, they retrieve the current drawing state from each player with [RPC](https://docs.livekit.io/home/client/data/rpc) by calling `player.get_drawing`.

### Game Control

Players have access to a simple API for game control, built on top of [RPC](https://docs.livekit.io/home/client/data/rpc) to the agent.

- `host.start_game`: Starts a new game with the given string prompt (leave blank for a random prompt)
- `host.update_difficulty`: Updates the difficulty setting for the next game
- `host.end_game`: Ends the current game without a winner

### Judgement

The agent is responsible for judging each player's drawing. It runs a single loop that wakes up every few seconds. On a judgement loop, the agent will:

1. Convert each player's drawing from a set of line segments to a 512x512 PNG image.
2. Send each drawing to a GPT-4o chat which is configured to "guess" what the drawing is meant to be. (Note: The actual target "prompt" is not included in this request, to avoid polluting its context.)
3. Collects all guesses and sends them to a different GPT-4o chat which is configured to return a list of all players whose guesses are "correct" (i.e. similar enough to the target prompt).
4. All guesses are published as data messages to all players, using the topic `host.guess`.
5. If any winners were found, the agent updates the game state to end the game and list the winners. Otherwise it sleeps for a few seconds and checks again.

### Audio Chat

Realtime chat is enabled within each room by [publishing the local microphone](https://docs.livekit.io/home/client/tracks/publish/) and [rendering the room audio](https://docs.livekit.io/reference/components/react/component/roomaudiorenderer/).

## Ideas & What's Next?

Learn to build with LiveKit by adding one of the following features, or come up with your own!

- Add a scoreboard that shows how many wins each player has racked up
    - We think [participant attributes](https://docs.livekit.io/home/client/data/participant-attributes/) is a great place to keep track of this
- Have the AI agent make its guesses and announce winners with realtime audio as well as text
    - We'd try using a LiveKit [Text-To-Speech (TTS) plugin](https://docs.livekit.io/agents/plugins/#text-to-speech-tts-)
    - To make it perfect, have the agent [publish](https://docs.livekit.io/home/client/tracks/publish/) a different audio track to each participant so they can hear the guesses for everyone else in realtime
- Add a room list on the front page that shows open rooms and lets you join any of them
    - We'd use the [List Rooms](https://docs.livekit.io/home/server/managing-rooms/#list-rooms) Server API in a Next.js API route
- Add support for multiple brush sizes and colors
    - You'll need to extend the data format for `Line` to record brush size and color

## Development & Running Locally

You'll need a LiveKit instance to run this project, either from [LiveKit Cloud](https://cloud.livekit.io) or [Self-hosted](https://docs.livekit.io/home/self-hosting/local/).

### Running the Agent

First add `agent/.env` with LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, and OPENAI_API_KEY.

Then run the following commands to install dependencies:

```shell
cd agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Finally, boot the agent:

```shell
python main.py dev
```

### Running the Site

First add `web/.env.local` with LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL.

Then run the following commands to install dependencies:

```shell
cd web
pnpm install
```

Finally, start the site:

```shell
pnpm dev
```
