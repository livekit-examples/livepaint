"use client";
import { useGame } from "@/providers/GameProvider";
import { PlayerTile } from "./PlayerTile";
import { RemoteParticipant } from "livekit-client";

// We'll use a smaller canvas size for the other players than our own.
// Since drawings are stored in unit coordinates, this is easy to implement.
const canvasSize = 172;
const strokeWidth = 1;

export function PlayersList() {
  const { remotePlayers } = useGame();

  return (
    <div className="flex flex-col h-full px-2 pt-0 overflow-y-auto max-h-[512px] overflow-x-hidden">
      <div className="flex flex-wrap gap-2">
        {/* Render a PlayerTile for each remote player */}
        {remotePlayers.map((player: RemoteParticipant) => (
          <PlayerTile
            key={player.identity}
            player={player}
            canvasSize={canvasSize}
            strokeWidth={strokeWidth}
          />
        ))}
      </div>
    </div>
  );
}
