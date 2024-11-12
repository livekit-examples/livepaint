"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/providers/GameProvider";

const canvasSize = 512;

export function Canvas() {
  const { gameState, onDrawLine, onClear, localDrawing } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.lineCap = "square";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        localDrawing.lines.forEach((line) => {
          ctx.beginPath();
          ctx.moveTo(
            line.fromPoint.x * canvas.width,
            line.fromPoint.y * canvas.height,
          );
          ctx.lineTo(
            line.toPoint.x * canvas.width,
            line.toPoint.y * canvas.height,
          );
          ctx.stroke();
        });
        setContext(ctx);
      }
    }
  }, [localDrawing]);

  const startDrawing = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (gameState.winners.length > 0 || !gameState.started) return;
      setIsDrawing(true);
      const canvas = canvasRef.current;
      if (canvas && context) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvas.width;
        const y = (event.clientY - rect.top) / canvas.height;
        context.beginPath();
        context.moveTo(x * canvas.width, y * canvas.height);
        lastXRef.current = x;
        lastYRef.current = y;
      }
    },
    [context, gameState.winners, gameState.started],
  );

  const draw = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !context || !gameState.started) return;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvas.width;
        const y = (event.clientY - rect.top) / canvas.height;
        context.lineTo(x * canvas.width, y * canvas.height);
        context.stroke();
        onDrawLine({
          fromPoint: {
            x: lastXRef.current,
            y: lastYRef.current,
          },
          toPoint: {
            x: x,
            y: y,
          },
        });
        lastXRef.current = x;
        lastYRef.current = y;
      }
    },
    [isDrawing, context, onDrawLine, gameState.started],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    if (context) {
      context.closePath();
    }
  }, [context]);

  const clearCanvas = useCallback(() => {
    if (context && canvasRef.current) {
      context.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      onClear();
    }
  }, [context, onClear]);

  return (
    <div className="flex flex-col h-full w-[512px]">
      <canvas
        className="drawing"
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{
          cursor:
            gameState.winners.length > 0 || !gameState.started
              ? "default"
              : "crosshair",
          opacity: gameState.started ? 1 : 0.5,
          pointerEvents: gameState.started ? "auto" : "none",
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <div className="field-row justify-end mt-2">
        <button
          onClick={clearCanvas}
          disabled={gameState.winners.length > 0 || !gameState.started}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
