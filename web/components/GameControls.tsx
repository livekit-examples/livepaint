"use client";
import { useGame, DifficultyLevel } from "@/providers/GameProvider";

export function GameControls({
  onCustomPrompt,
}: {
  onCustomPrompt: () => void;
}) {
  const {
    gameState,
    startGame,
    updateDifficulty,
    host,
    endGame,
    guesses,
    localPlayer,
    room,
  } = useGame();

  return (
    <fieldset>
      <legend>Room {room?.name}</legend>
      <div className="flex flex-row justify-between gap-2">
        <div className="flex-1">
          <p className="my-0">
            Game prompt:
            <span className="text-lg ml-2">
              {gameState.started ? gameState.prompt : ""}
            </span>
          </p>
          <p className="my-0">
            Last guessed:
            <span className="text-lg ml-2">
              {guesses.get(localPlayer?.identity ?? "")}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <label htmlFor="difficulty">Difficulty:</label>
          <select
            id="difficulty"
            value={gameState.difficulty}
            disabled={gameState.started}
            onChange={(e) =>
              updateDifficulty(e.target.value as DifficultyLevel)
            }
            className="w-24"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {gameState.started ? (
            <button
              onClick={() => endGame()}
              title={!host ? "Waiting for AI host to join…" : "Start Game"}
            >
              End Game
            </button>
          ) : (
            <button
              onClick={() => startGame(undefined)}
              disabled={!host}
              title={!host ? "Waiting for AI host to join…" : "Start Game"}
            >
              Start Game
            </button>
          )}

          <button
            onClick={onCustomPrompt}
            title="Custom prompt"
            disabled={gameState.started}
          >
            Custom Prompt
          </button>
        </div>
      </div>
    </fieldset>
  );
}
