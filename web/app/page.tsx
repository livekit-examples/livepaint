"use client";

import { GameProvider, useGame } from "@/providers/GameProvider";
import { PlayersList } from "@/components/PlayersList";
import { ConnectionForm } from "@/components/ConnectionForm";
import { UrlRoomNameProvider } from "@/providers/UrlRoomNameProvider";
import { GameControls } from "@/components/GameControls";
import { Canvas } from "@/components/Canvas";
import { HelpWindow } from "@/components/HelpWindow";
import { useState } from "react";
import { WinnerWindow } from "@/components/WinnerWindow";
import { useEffect } from "react";
import { CustomPromptWindow } from "@/components/CustomPromptWindow";

export default function Page() {
  return (
    <GameProvider>
      <Inner />
    </GameProvider>
  );
}

function Inner() {
  const { connect, connectionState, disconnect, gameState, kickReason } = useGame();
  const [showHelp, setShowHelp] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);

  useEffect(() => {
    if (gameState.winners.length > 0) {
      setShowWinnerModal(true);
    }
  }, [gameState.winners]);

  return (
    <main className="h-screen flex justify-center items-center">
      {connectionState === "connected" ? (
        <div className="window w-[768px] h-[676px]">
          <div className="title-bar">
            <div className="title-bar-text">LivePaint</div>
            <div className="title-bar-controls">
              <button
                aria-label="Help"
                onClick={() => setShowHelp(true)}
              ></button>
              <button aria-label="Close" onClick={disconnect}></button>
            </div>
          </div>
          <div className="window-body">
            <GameControls
              onCustomPrompt={() => setShowCustomPromptModal(true)}
            />
            <div className="flex w-full mt-1 h-full">
              <Canvas />
              <PlayersList />
            </div>
          </div>

          {showWinnerModal && (
            <WinnerWindow onClose={() => setShowWinnerModal(false)} />
          )}
          {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />}
          {showCustomPromptModal && (
            <CustomPromptWindow
              onClose={() => setShowCustomPromptModal(false)}
            />
          )}
        </div>
      ) : (
        <UrlRoomNameProvider>
          <ConnectionForm
            onConnect={connect}
            connecting={connectionState === "connecting"}
            kickReason={kickReason}
          />
        </UrlRoomNameProvider>
      )}
    </main>
  );
}
