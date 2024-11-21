"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/providers/GameProvider";

// Same size canvas for all device types. Future improvement would make this dynamic especially for mobile.
// This happens to be the same size as the host uses to send drawings to GPT-4o-mini so it maximizes accuracy
const canvasSize = 512;
const strokeWidth = 4;

// This component provides the drawing canvas
export function Canvas() {
  // Our useGame hook provides us with the game state and functions to broadcast drawing events
  const { gameState, onDrawLine, onClear, localDrawing } = useGame();

  // We use a ref to access the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // We use refs to track the last x and y coordinates of the mouse
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);

  // We use a local state variable to track whether the player is currently drawing (holding down the mouse button)
  const [isDrawing, setIsDrawing] = useState(false);

  // We use a local state variable to access the canvas rendering context
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  // Redraw the canvas if the local drawing changes from outside this component
  // This can happen whenever the GameContextProvider clears the canvas to start a new round
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "square";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        localDrawing.lines.forEach((line) => {
          ctx.beginPath();
          ctx.moveTo(
            line.fromPoint.x * canvas.width,
            line.fromPoint.y * canvas.height
          );
          ctx.lineTo(
            line.toPoint.x * canvas.width,
            line.toPoint.y * canvas.height
          );
          ctx.stroke();
        });
        setContext(ctx);
      }
    }
  }, [localDrawing]);

  // When the player presses the mouse button, we enter drawing mode
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
    [context, gameState.winners, gameState.started]
  );

  // When the player moves the mouse while holding down the button, we draw a new line
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
    [isDrawing, context, onDrawLine, gameState.started]
  );

  // When the player releases the mouse button, we exit drawing mode
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    if (context) {
      context.closePath();
    }
  }, [context]);

  // When the player clicks the "Clear" button, we clear the canvas
  const clearCanvas = useCallback(() => {
    if (context && canvasRef.current) {
      context.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
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
          cursor: !gameState.started ? "default" : "crosshair",
          opacity: gameState.started ? 1 : 0.5,
          pointerEvents: gameState.started ? "auto" : "none",
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <div className="field-row justify-end mt-2">
        <button onClick={clearCanvas} disabled={!gameState.started}>
          Clear
        </button>
      </div>
    </div>
  );
}
