from dotenv import load_dotenv
from livekit import agents

from game_host import GameHost

# We use .env to load secrets such as API keys
# This makes it easy to use different keys for local development vs production
# And ensure the secrets can be kept out of source control (via .gitignore)
load_dotenv()


# The main entrypoint for a LiveKit agent. See https://docs.livekit.io/agents/build/anatomy/#entrypoint
# We've created our own class to handle all of the agent logic and state, so we'll just pass off control to it
async def entrypoint(ctx: agents.JobContext):
    host = GameHost(ctx)

    # Connects to the LiveKit room
    await host.connect()


if __name__ == "__main__":
    # This is a simple worker configuration that means "Join every new room"
    # See https://docs.livekit.io/agents/build/anatomy/#worker-options for more details
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
