"use client";
import { useGame } from "@/providers/GameProvider";
import { PlayerTile } from "./PlayerTile";
import { RemoteParticipant } from "livekit-client";

const canvasSize = 172;

export function PlayersList() {
  const { remotePlayers } = useGame();

  return (
    <div className="flex flex-col h-full px-2 pt-0 overflow-y-auto max-h-[512px] overflow-x-hidden">
      <div className="flex flex-wrap gap-2">
        {remotePlayers.map((player: RemoteParticipant) => (
          <PlayerTile
            key={player.identity}
            player={player}
            canvasSize={canvasSize}
          />
        ))}
      </div>
    </div>
  );
}
