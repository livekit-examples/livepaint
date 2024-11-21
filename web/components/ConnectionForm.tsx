"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useUrlRoomName } from "@/providers/UrlRoomNameProvider";
import { HelpWindow } from "./HelpWindow";
import { useGame } from "@/providers/GameProvider";
import logo from "@/assets/logo.svg";
import { Window } from "@/components/Window";

// This component renders the connection form, which is the initial UI the player will see
export function ConnectionForm() {
  // Our useGame hook provides us with the just about everything we need for this component
  const {
    connect,
    connectionState,
    kickReason,
    shouldEnableMicrophone,
    setShouldEnableMicrophone,
  } = useGame();

  // Local state to track the player name
  const [playerName, setPlayerName] = useState("");

  // Our UrlRoomNameProvider lets us sync the room name with the URL hash
  const { urlRoomName: roomName, setUrlRoomName: setRoomName } =
    useUrlRoomName();

  // Local state to track whether the help window is shown
  const [showHelp, setShowHelp] = useState(false);

  // Load the player name from local storage, if any
  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) setPlayerName(savedName);
  }, []);

  // Connect to the game
  const onConnectButtonClicked = useCallback(() => {
    localStorage.setItem("playerName", playerName);
    connect(roomName, playerName);
  }, [playerName, roomName, connect]);

  return (
    <>
      <Window className="w-[500px]">
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
          </div>
        </div>
        <div className="window-body">
          <div className="field-row text-sm">
            Welcome to LivePaint, the realtime drawing game from the future.
          </div>
          <div className="field-row-stacked">
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={connectionState === "connecting"}
            />
          </div>
          <div className="field-row-stacked">
            <label htmlFor="roomName">Room Name</label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              disabled={connectionState === "connecting"}
            />
          </div>
          <section className="field-row" style={{ justifyContent: "flex-end" }}>
            <input
              id="enableMicrophone"
              type="checkbox"
              checked={shouldEnableMicrophone}
              onChange={(e) => setShouldEnableMicrophone(e.target.checked)}
            />
            <label htmlFor="enableMicrophone">Enable Microphone</label>
            <button
              disabled={connectionState === "connecting"}
              onClick={onConnectButtonClicked}
            >
              {/* Use LiveKit's connection state for a status indicator */}
              {connectionState === "connecting" ? "Connecting…" : "Connect"}
            </button>
          </section>

          {/* Upon disconnection, show the reason why */}
          {kickReason && (
            <div className="text-sm text-red-500 text-right">{kickReason}</div>
          )}
        </div>
      </Window>

      {/* Show the help window if requested */}
      {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />}
    </>
  );
}
