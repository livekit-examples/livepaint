"use client";

import { GameProvider, useGame } from "@/providers/GameProvider";
import { PlayersList } from "@/components/PlayersList";
import { ConnectionForm } from "@/components/ConnectionForm";
import { UrlRoomNameProvider, useUrlRoomName } from "@/providers/UrlRoomNameProvider";
import { GameControls } from "@/components/GameControls";
import { Canvas } from "@/components/Canvas";
import { HelpWindow } from "@/components/HelpWindow";
import { useState, useRef } from "react";
import { WinnerWindow } from "@/components/WinnerWindow";
import { useEffect } from "react";
import { CustomPromptWindow } from "@/components/CustomPromptWindow";
import { RoomAudioRenderer } from "@livekit/components-react";
import logo from "@/assets/logo.svg";
import Image from "next/image";
import LiveKitLogo from "@/assets/livekit.svg";
import { Window } from "@/components/Window";
import { BSOD } from "@/components/BSOD";

export default function Page() {
  // Our GameProvider wraps our app and makes the game state and connection state available to all components
  return (
    <GameProvider>
      <UrlRoomNameProvider>
        <Inner />
      </UrlRoomNameProvider>
    </GameProvider>
  );
}

function Inner() {
  // Our useGame hook provides us with the game state and connection state, and a set of functions to interact with the game
  const { connectionState, disconnect, gameState, room, isBSOD } = useGame();

  // Local state variables to manage our UI
  const [showHelp, setShowHelp] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);
  const prevGameStartedRef = useRef(false);

  const { urlRoomName } = useUrlRoomName();

  useEffect(() => {
    if (urlRoomName && urlRoomName !== room?.name) {
      disconnect();
    }
  }, [urlRoomName, room?.name, disconnect]);

  // Show the winner modal when the game ends
  useEffect(() => {
    if (
      gameState.winners.length > 0 &&
      gameState.started === false &&
      prevGameStartedRef.current === true
    ) {
      setShowWinnerModal(true);
    } else if (gameState.started === true) {
      setShowWinnerModal(false);
    }
    prevGameStartedRef.current = gameState.started;
  }, [gameState.winners, gameState.started]);

  return (
    <>
      <main className="h-screen flex justify-center items-center">
        {/* In-room connected state (game UI) */}
        {connectionState === "connected" ? (
          <>
            <Window className="w-[768px] h-[676px]">
              <div className="title-bar">
                <div className="title-bar-text">
                  <Image
                    src={logo}
                    alt="LivePaint"
                    height={12}
                    width={12}
                    className="mr-1"
                  />
                  LivePaint
                </div>
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

              {/* Allows audio playback (for voice chat) */}
              {room && <RoomAudioRenderer />}
            </Window>

            {/* extra windows for various modal states */}
            {showWinnerModal && (
              <WinnerWindow onClose={() => setShowWinnerModal(false)} />
            )}
            {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />}
            {showCustomPromptModal && (
              <CustomPromptWindow
                onClose={() => setShowCustomPromptModal(false)}
              />
            )}
          </>
        ) : (
          // Disconnected state (connection form)
          <ConnectionForm />
        )}
      </main>
      <footer className="absolute bottom-0 w-full text-sm p-2 flex justify-between box-border">
        <span className="flex items-center">
          <Image
            src={LiveKitLogo}
            alt="LiveKit"
            height={18}
            width={18}
            className="mr-2"
          />
          Built with LiveKit
        </span>
        <a
          href="https://github.com/livekit-examples/livepaint"
          target="_blank"
          rel="noreferrer"
        >
          View Source
        </a>
      </footer>

      {/* Takeover UI for cheating detection */}
      {isBSOD && <BSOD />}
    </>
  );
}
