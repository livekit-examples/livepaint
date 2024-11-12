# LivePaint

This is an example project demonstrating how to build a realtime data app using LiveKit.

In this example, we build a realtime drawing game where players compete to complete a drawing prompt as fast as possible, while being judged by an AI agent that oversees the whole game.

See it live at [https://live-paint.vercel.app](https://live-paint.vercel.app)

## Architecture

### Rooms & Participants

Each game is hosted in a single [LiveKit room](https://docs.livekit.io/home/client/connect) where each player is a standard participant.  The room is reused between games, so the same group of players can complete multiple games back-to-back.

Each room also contains a single [LiveKit agent](https://docs.livekit.io/agents) that handles game logic and serves as the realtime backend for the game.

### Game State

Game state is stored in the [room metadata](https://docs.livekit.io/home/client/data/room-metadata/). Each player observes it and updates local UI accordingly, but only the agent is responsible for updating it.

- `game_state.started`: Whether a game is currently in progress
- `game_state.prompt`: The current drawing prompt (must be non-null if the game has started)
- `game_state.difficulty`: The difficulty of the current round
- `game_state.winners`: List of players (by identity) who won the most recent game (cleared when a new game starts)


### Drawings

Drawings are stored as an unordered set of line segments, each represented by a start point and end point. When a player clears their drawing, or a new game starts, the set is emptied.

Drawing updates are published using realtime [data messages](https://docs.livekit.io/home/client/data/messages) with the topics `player.draw_line` and `player.clear_drawing`. Drawings are stored in unit coordinates, which each point between 0 and 1 to be size-agnostic. However, when sent as a data message each segment is serialized as four 16-bit integers (representing `x1`, `y1`, `x2`, `y2`) between 0 and 65535 to minimize the message size. Each player, and the agent, reconsitutes the full drawing from these messages.

When a player joins an inprogress game, they retrieve the current drawing state from each player with [RPC](https://docs.livekit.io/home/client/data/rpc) by calling `player.get_drawing`.

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

### Running Locally

Run the agent:

```
cd agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py dev
```

Run the site:

```
cd web
pnpm install
pnpm dev
```
