"use client";
import { useEffect, useRef, useMemo } from "react";
import { Line } from "@/lib/drawings";
import { RemoteParticipant } from "livekit-client";
import { useGame } from "@/providers/GameProvider";

export function PlayerTile({
  player,
  canvasSize,
}: {
  player: RemoteParticipant;
  canvasSize: number;
}) {
  const { drawings, guesses, gameState } = useGame();
  const isWinner = useMemo(
    () => gameState.winners.includes(player.identity),
    [gameState.winners, player.identity],
  );
  const currentGuess = useMemo(
    () => guesses.get(player.identity),
    [guesses, player.identity],
  );
  const drawing = useMemo(
    () => drawings.get(player.identity),
    [drawings, player.identity],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reconstruct drawing from events
    if (drawing?.lines) {
      drawing?.lines.forEach((line: Line) => {
        ctx.beginPath();
        ctx.moveTo(
          line.fromPoint.x * canvasSize,
          line.fromPoint.y * canvasSize,
        );
        ctx.lineTo(line.toPoint.x * canvasSize, line.toPoint.y * canvasSize);
        ctx.lineWidth = 1;
        ctx.lineCap = "square";
        ctx.strokeStyle = "#000";
        ctx.stroke();
      });
    }
  }, [drawing?.lines, canvasRef, canvasSize]);
  return (
    <fieldset className="w-full box-border">
      <legend className={`text-lg`}>
        {isWinner && "👑"} {player.name}
      </legend>
      {currentGuess && (
        <span className="ml-2 text-gray-500">({currentGuess})</span>
      )}
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className="drawing"
      />
    </fieldset>
  );
}
