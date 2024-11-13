import { useGame } from "@/providers/GameProvider";
import { useMemo } from "react";
import { Window } from "@/components/Window";
export function WinnerWindow({ onClose }: { onClose: () => void }) {
  const { localPlayer, remotePlayers, gameState } = useGame();

  const winnerText = useMemo(() => {
    let winnerText = "";
    if (gameState.winners.includes(localPlayer?.identity ?? "")) {
      if (gameState.winners.length === 1) {
        winnerText = "You won! 🎉";
      } else {
        winnerText =
          "You tied with " +
          gameState.winners
            .filter((identity: string) => identity !== localPlayer?.identity)
            .map(
              (identity: string) =>
                remotePlayers.find((p) => p.identity === identity)?.name ??
                identity,
            )
            .join(", ");
      }
    } else if (gameState.winners.length > 0) {
      winnerText =
        gameState.winners
          .map(
            (identity: string) =>
              remotePlayers.find((p) => p.identity === identity)?.name ??
              identity,
          )
          .join(", ") + " won. You lost :(";
    }
    return winnerText;
  }, [localPlayer, gameState, remotePlayers]);

  return (
    <Window className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-100">
      <div className="title-bar">
        <div className="title-bar-text">Game Over!</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        <p className="text-center m-4">{winnerText}</p>
      </div>
    </Window>
  );
}
