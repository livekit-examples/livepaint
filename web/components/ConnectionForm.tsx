"use client";

import { useState, useCallback, useEffect } from "react";
import { useUrlRoomName } from "@/providers/UrlRoomNameProvider";
import { HelpWindow } from "./HelpWindow";
export interface ConnectionFormProps {
  onConnect: (playerName: string, roomName: string) => void;
  connecting: boolean;
  kickReason?: string;
}

export function ConnectionForm({
  onConnect,
  connecting,
  kickReason,
}: ConnectionFormProps) {
  const [playerName, setPlayerName] = useState("");
  const { urlRoomName: roomName, setUrlRoomName: setRoomName } =
    useUrlRoomName();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) setPlayerName(savedName);
  }, []);

  const onConnectButtonClicked = useCallback(() => {
    localStorage.setItem("playerName", playerName);
    onConnect(playerName, roomName);
  }, [playerName, roomName, onConnect]);

  return (
    <div className="window w-[500px]">
      <div className="title-bar">
        <div className="title-bar-text">LivePaint</div>
        <div className="title-bar-controls">
          <button aria-label="Help" onClick={() => setShowHelp(true)}></button>
        </div>
      </div>
      <div className="window-body">
        <div className="field-row">
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
            disabled={connecting}
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
            disabled={connecting}
          />
        </div>
        <section className="field-row" style={{ justifyContent: "flex-end" }}>
          <button disabled={connecting} onClick={onConnectButtonClicked}>
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </section>
        {kickReason && (
          <div className="text-sm text-red-500 text-right">{kickReason}</div>
        )}
      </div>
      {showHelp && <HelpWindow onClose={() => setShowHelp(false)} />}
    </div>
  );
}
