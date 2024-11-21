"use client";
import { useEffect, useRef, useMemo } from "react";
import { Line } from "@/lib/drawings";
import { RemoteParticipant } from "livekit-client";
import { useGame } from "@/providers/GameProvider";

// This is similar to the `Canvas` component, but is not interactive
// It's used to render the drawings of other players in the game
export function PlayerTile({
  player,
  canvasSize,
  strokeWidth,
}: {
  player: RemoteParticipant;
  canvasSize: number;
  strokeWidth: number;
}) {
  const { drawings, guesses, gameState } = useGame();

  // The winner and guesses are indexed by player identity (not name)
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
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "square";
        ctx.strokeStyle = "#000";
        ctx.stroke();
      });
    }
  }, [drawing?.lines, canvasRef, canvasSize, strokeWidth]);
  return (
    <fieldset className="w-full box-border">
      <legend className={`text-lg`}>
        {isWinner && "👑"} {player.name}
      </legend>
      Guess: {currentGuess && <span className="font-bold">{currentGuess}</span>}
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className="drawing"
      />
    </fieldset>
  );
}
