"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  RemoteParticipant,
  ParticipantKind,
  RoomEvent,
  DataPacket_Kind,
  Room,
  LocalParticipant,
  RpcInvocationData,
  ConnectionState,
} from "livekit-client";
import { Line, PlayerDrawing, decodeLine, encodeLine } from "@/lib/drawings";
import {
  useRemoteParticipants,
  useLocalParticipant,
  useRoomInfo,
  useConnectionState,
} from "@livekit/components-react";

export enum DifficultyLevel {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export interface GameState {
  started: boolean;
  prompt: string | undefined;
  difficulty: DifficultyLevel;
  winners: string[];
}

export interface GameContextType {
  connectionState: ConnectionState;
  host: RemoteParticipant | undefined;
  localPlayer: LocalParticipant | undefined;
  remotePlayers: RemoteParticipant[];
  room: Room | undefined;
  gameState: GameState;
  guesses: Map<string, string>;
  drawings: Map<string, PlayerDrawing>;
  connect: (playerName: string, roomName: string) => Promise<void>;
  disconnect: () => void;
  startGame: (prompt: string | undefined) => void;
  endGame: () => void;
  onDrawLine: (line: Line) => void;
  onClear: () => void;
  updateDifficulty: (difficulty: DifficultyLevel) => void;
  localDrawing: PlayerDrawing;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room>(new Room());
  const [drawings, setDrawings] = useState<Map<string, PlayerDrawing>>(
    new Map(),
  );
  const [guesses, setGuesses] = useState<Map<string, string>>(new Map());
  const remoteParticipants = useRemoteParticipants({ room });
  const remotePlayers = useMemo(() => {
    return Array.from(remoteParticipants.values()).filter(
      (p) => p.kind !== ParticipantKind.AGENT,
    );
  }, [remoteParticipants]);
  const { localParticipant: localPlayer } = useLocalParticipant({ room });
  const host = useMemo(() => {
    return remoteParticipants.find((p) => p.kind === ParticipantKind.AGENT);
  }, [remoteParticipants]);
  const { metadata } = useRoomInfo({ room });
  const gameState = useMemo(() => {
    return metadata
      ? JSON.parse(metadata)
      : { started: false, prompt: undefined, winners: [] };
  }, [metadata]);
  const [localDrawing, setLocalDrawing] = useState<PlayerDrawing>(
    new PlayerDrawing(),
  );

  const connectionState = useConnectionState(room);

  const disconnect = useCallback(() => {
    room.disconnect();
    setDrawings(new Map());
  }, [room]);

  const connect = useCallback(
    async (playerName: string, roomName: string) => {
      playerName = playerName.trim();
      roomName = roomName.trim();

      if (!playerName || !roomName) {
        alert("Please enter your name and room name first");
        return;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), 15000);
      });

      try {
        const url = new URL(
          process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
            `/api/connection-details?playerName=${encodeURIComponent(
              playerName,
            )}&roomName=${encodeURIComponent(roomName)}`,
          window.location.origin,
        );

        await Promise.race([
          (async () => {
            const response = await fetch(url.toString());
            const connectionDetailsData = await response.json();
            await room.connect(
              connectionDetailsData.serverUrl,
              connectionDetailsData.participantToken,
            );
          })(),
          timeoutPromise,
        ]);
      } catch (error) {
        console.error("Connection failed:", error);
        disconnect();
        alert(
          "Failed to connect: " +
            (error instanceof Error ? error.message : "Unknown error"),
        );
      }

      for (const participant of Array.from(room.remoteParticipants.values())) {
        if (participant.kind === ParticipantKind.AGENT) {
          continue;
        }

        const drawingB64 = await room.localParticipant.performRpc({
          method: "player.get_drawing",
          destinationIdentity: participant.identity,
          payload: "",
        });
        const drawingData = Buffer.from(drawingB64, "base64");
        const drawing = new PlayerDrawing();
        for (let i = 0; i < drawingData.length; i += 8) {
          drawing.addLine(decodeLine(drawingData.subarray(i, i + 8)));
        }
        setDrawings((prev) => new Map(prev).set(participant.identity, drawing));
      }
    },
    [room, disconnect],
  );

  const startGame = useCallback(
    async (prompt: string | undefined) => {
      if (!host) {
        console.log("Can't start game, not connected");
        return;
      }

      await localPlayer.performRpc({
        destinationIdentity: host.identity,
        method: "host.start_game",
        payload: JSON.stringify({ prompt: prompt?.trim() }),
      });
    },
    [localPlayer, host],
  );

  const endGame = useCallback(async () => {
    if (!host) {
      console.log("Can't reset game, not connected");
      return;
    }

    await localPlayer.performRpc({
      destinationIdentity: host.identity,
      method: "host.end_game",
      payload: "",
    });
  }, [localPlayer, host]);

  useEffect(() => {
    setDrawings(new Map());
    setGuesses(new Map());
    setLocalDrawing(new PlayerDrawing());
  }, [gameState.started]);

  const onDrawLine = useCallback(
    (line: Line) => {
      localDrawing.addLine(line);
      localPlayer?.publishData(encodeLine(line), {
        reliable: true,
        topic: "player.draw_line",
      });
    },
    [localPlayer, localDrawing],
  );

  const onClear = useCallback(() => {
    localDrawing.clear();
    localPlayer?.publishData(new Uint8Array(), {
      reliable: true,
      topic: "player.clear_drawing",
    });
  }, [localPlayer, localDrawing]);

  const updateDifficulty = useCallback(
    (difficulty: DifficultyLevel) => {
      if (!host) {
        console.log("Can't update difficulty, not connected");
        return;
      }

      localPlayer?.performRpc({
        destinationIdentity: host.identity,
        method: "host.update_difficulty",
        payload: JSON.stringify({ difficulty }),
      });
    },
    [localPlayer, host],
  );

  useEffect(() => {
    const handler = (
      payload: Uint8Array,
      participant: RemoteParticipant | undefined,
      kind: DataPacket_Kind | undefined,
      topic: string | undefined,
    ) => {
      if (!participant) {
        return;
      }

      if (topic === "player.draw_line") {
        const line = decodeLine(payload);
        console.log("received line", line);
        setDrawings((prev: Map<string, PlayerDrawing>) => {
          const drawing = prev.get(participant.identity) ?? new PlayerDrawing();
          drawing.addLine(line);
          return new Map(prev).set(participant.identity, drawing);
        });
      } else if (topic === "player.clear_drawing") {
        setDrawings((prev: Map<string, PlayerDrawing>) => {
          const drawing = prev.get(participant.identity) ?? new PlayerDrawing();
          drawing.clear();
          return new Map(prev).set(participant.identity, drawing);
        });
      } else if (topic === "host.guess") {
        const guesses = new Map<string, string>(
          Object.entries(JSON.parse(new TextDecoder().decode(payload))),
        );
        setGuesses(guesses);
      }
    };

    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  useEffect(() => {
    async function handleGetDrawing(data: RpcInvocationData) {
      const totalLength = localDrawing.lines.length * 8; // Each line is 4 uint16 = 8 bytes
      const buffer = new Uint8Array(totalLength);
      localDrawing.lines.forEach((line, i) => {
        const encodedLine = encodeLine(line);
        buffer.set(encodedLine, i * 8);
      });
      return Buffer.from(buffer).toString("base64");
    }
    console.log("registering get_drawing");
    localPlayer?.registerRpcMethod("player.get_drawing", handleGetDrawing);
    return () => {
      console.log("unregistering get_drawing");
      localPlayer?.unregisterRpcMethod("player.get_drawing");
    };
  }, [localPlayer, localDrawing]);

  return (
    <GameContext.Provider
      value={{
        connectionState,
        host,
        localPlayer,
        remotePlayers,
        room,
        gameState,
        guesses,
        drawings,
        connect,
        disconnect,
        startGame,
        endGame,
        onDrawLine,
        onClear,
        updateDifficulty,
        localDrawing,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
