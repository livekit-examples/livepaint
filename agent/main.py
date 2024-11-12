from dotenv import load_dotenv
from livekit import agents

from game_host import GameHost

load_dotenv()


async def entrypoint(ctx: agents.JobContext):
    host = GameHost(ctx)
    await host.connect()


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
