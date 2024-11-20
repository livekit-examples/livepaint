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
  RoomContext,
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

// A React context that collects and manages all of the game state and logic so each UI component can easily access it
export interface GameContextType {
  // LiveKit Room connection state
  connectionState: ConnectionState;

  // The host (agent) participant
  host: RemoteParticipant | undefined;

  // The local player participant
  localPlayer: LocalParticipant | undefined;

  // All remote players (not including the host)
  remotePlayers: RemoteParticipant[];

  // The underlying LiveKit room
  room: Room | undefined;

  // The current game state (parsed from the room metadata)
  gameState: GameState;

  // Latest guesses for each player from the host
  guesses: Map<string, string>;

  // Current drawings for each player (updated incrementally via data messages)
  drawings: Map<string, PlayerDrawing>;

  // The local player's current drawing
  localDrawing: PlayerDrawing;

  // The reason the local player was kicked from the room, if any (for display)
  kickReason: string | undefined;

  // Whether microphone is enabled for the local player (for realtime voice chat)
  shouldEnableMicrophone: boolean;

  // Whether the cheater detected screen should be shown to the local player
  isBSOD: boolean;

  // Connect to the given room with the given player name
  connect: (playerName: string, roomName: string) => Promise<void>;

  // Disconnect from the current room
  disconnect: () => void;

  // Start the game with the given prompt (if any) via RPC to the host
  startGame: (prompt: string | undefined) => void;

  // End the current game via RPC to the host
  endGame: () => void;

  // Add a line to the local player's drawing and broadcast it to the room
  onDrawLine: (line: Line) => void;

  // Clear the local player's drawing and broadcast it to the room
  onClear: () => void;

  // Update the game difficulty via RPC to the host
  updateDifficulty: (difficulty: DifficultyLevel) => void;

  // Enable/disable your microphone for voice chat with other players
  setShouldEnableMicrophone: (enabled: boolean) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  // We'll manage our own Room instance, rather than using the `<LiveKitRoom />` component
  const [room, setRoom] = useState<Room>(new Room());

  // We use a local state variable to track the current drawings for each player
  const [drawings, setDrawings] = useState<Map<string, PlayerDrawing>>(
    new Map(),
  );

  // We use a local state variable to track the latest guesses for each player from the host
  const [guesses, setGuesses] = useState<Map<string, string>>(new Map());

  // We use the `useRemoteParticipants` LiveKit hook to monitor all remote participants
  const remoteParticipants = useRemoteParticipants({ room });

  // Filter the remoteParticipants so that it's easy for other components to render only the actual players (not the host agent)
  const remotePlayers = useMemo(() => {
    return Array.from(remoteParticipants.values()).filter(
      (p) => p.kind !== ParticipantKind.AGENT,
    );
  }, [remoteParticipants]);

  // We use the `useLocalParticipant` LiveKit hook to monitor the local player, but call it `localPlayer` for clarity within the game
  const { localParticipant: localPlayer } = useLocalParticipant({ room });

  // Find the host (agent) participant and make it easy to access
  const host = useMemo(() => {
    return remoteParticipants.find((p) => p.kind === ParticipantKind.AGENT);
  }, [remoteParticipants]);

  // Game state is stored in room metadata, updated by the host.  We use the `useRoomInfo` LiveKit hook to monitor and parse it
  const { metadata } = useRoomInfo({ room });
  const gameState = useMemo(() => {
    return metadata
      ? JSON.parse(metadata)
      : { started: false, prompt: undefined, winners: [] };
  }, [metadata]);

  // We use a local state variable to track the local player's current drawing
  const [localDrawing, setLocalDrawing] = useState<PlayerDrawing>(
    new PlayerDrawing(),
  );

  // We use a local state variable to track the reason the local player was kicked from the room, if any
  const [kickReason, setKickReason] = useState<string | undefined>(undefined);

  // We use the `useConnectionState` LiveKit hook to monitor the connection state
  const connectionState = useConnectionState(room);

  // We use a local state variable to track the microphone enabled state for the local player
  const [shouldEnableMicrophone, setShouldEnableMicrophone] = useState(true);

  // We use a local state variable to track whether the cheater detected screen should be shown to the local player
  const [isBSOD, setIsBSOD] = useState(false);

  // Disconnect from the current room
  const disconnect = useCallback(() => {
    room.disconnect();
    setDrawings(new Map());
  }, [room]);

  // Connect to the given room with the given player name
  const connect = useCallback(
    async (roomName: string, playerName: string) => {
      playerName = playerName.trim();
      roomName = roomName.trim();

      if (!playerName || !roomName) {
        alert("Please enter your name and room name first");
        return;
      }

      setKickReason(undefined);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), 15000);
      });

      try {
        // To connect, we'll need a LiveKit access token and server URL
        // These are available from our connection details endpoint
        // See `/api/connection-details/route.ts` for more information
        const url = new URL(
          process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
            `/api/connection-details?playerName=${encodeURIComponent(
              playerName
            )}&roomName=${encodeURIComponent(roomName)}`,
          window.location.origin
        );

        // We'll attempt to connect to the room using the connection details
        // If we don't receive them in time, we'll disconnect and try again
        await Promise.race([
          (async () => {
            const response = await fetch(url.toString());
            const connectionDetailsData = await response.json();

            // Connect to the LiveKit room using the provided token and server URL
            await room.connect(
              connectionDetailsData.serverUrl,
              connectionDetailsData.participantToken
            );
          })(),
          timeoutPromise,
        ]);
      } catch (error) {
        console.error("Connection failed:", error);
        disconnect();
        alert(
          "Failed to connect: " +
            (error instanceof Error ? error.message : "Unknown error")
        );
      }

      // After connection, we'll set the microphone enabled state for the local player
      // If enabled, this will immediately trigger the microphone permission prompt and start publishing audio
      // See https://docs.livekit.io/home/client/tracks/publish/ for more information
      await room.localParticipant.setMicrophoneEnabled(shouldEnableMicrophone);

      // We also need to request the latest drawings from each other player, in case we joined a game in progress
      for (const participant of Array.from(room.remoteParticipants.values())) {
        if (participant.kind === ParticipantKind.AGENT) {
          continue;
        }

        // Drawings are encoded as base64 bytes to be as space-efficient as possible
        const drawingB64 = await room.localParticipant.performRpc({
          method: "player.get_drawing",
          destinationIdentity: participant.identity,
          payload: "", // No payload is needed as this method has no parameters
        });
        const drawingData = Buffer.from(drawingB64, "base64");
        const drawing = new PlayerDrawing();
        for (let i = 0; i < drawingData.length; i += 8) {
          // Each line is 8 bytes. See the `decodeLine` function in `drawings.ts` for more information
          drawing.addLine(decodeLine(drawingData.subarray(i, i + 8)));
        }
        setDrawings((prev) => new Map(prev).set(participant.identity, drawing));
      }
    },
    [room, disconnect, shouldEnableMicrophone]
  );

  // Start the game with the given prompt via RPC to the host
  const startGame = useCallback(
    async (prompt: string | undefined) => {
      if (!host) {
        console.log("Can't start game, not connected");
        return;
      }

      // We perform RPC to the host, which is in charge of managing game state
      await localPlayer.performRpc({
        destinationIdentity: host.identity,
        method: "host.start_game",

        // payload is a string, and by convention we are using JSON for this method's parameters
        payload: JSON.stringify({ prompt: prompt?.trim() }),
      });
    },
    [localPlayer, host]
  );

  // End the current game via RPC to the host
  const endGame = useCallback(async () => {
    if (!host) {
      console.log("Can't reset game, not connected");
      return;
    }

    await localPlayer.performRpc({
      destinationIdentity: host.identity,
      method: "host.end_game",
      payload: "", // No payload is needed as this method has no parameters
    });
  }, [localPlayer, host]);

  // When a new game starts, reset the drawings and guesses
  useEffect(() => {
    if (gameState.started) {
      setDrawings(new Map());
      setGuesses(new Map());
      setLocalDrawing(new PlayerDrawing());
    }
  }, [gameState.started]);

  // When the local player draws a line, broadcast it to the room using data messages
  // See https://docs.livekit.io/home/client/data/data-messages/ for more information
  const onDrawLine = useCallback(
    (line: Line) => {
      localDrawing.addLine(line);
      // We encode the line as a compact binary format to save on space
      // See the `encodeLine` function in `drawings.ts` for more information
      localPlayer?.publishData(encodeLine(line), {
        // Reliable messages should ensure ordered delivery, which is necessary to ensure a clear event is sent in order with new lines
        reliable: true,

        // We use a special topic so the other participants know how to process this data message
        topic: "player.draw_line",
      });
    },
    [localPlayer, localDrawing]
  );

  // When the local player clears their drawing, broadcast it to the room using data messages
  // See https://docs.livekit.io/home/client/data/data-messages/ for more information
  const onClear = useCallback(() => {
    localDrawing.clear();
    localPlayer?.publishData(new Uint8Array(), {
      // Reliable messages should ensure ordered delivery, which is necessary to ensure a clear event is sent in order with new lines
      reliable: true,

      // We use a special topic so the other participants know how to process this data message
      topic: "player.clear_drawing",
    });
  }, [localPlayer, localDrawing]);

  // Update the game difficulty via RPC to the host
  const updateDifficulty = useCallback(
    (difficulty: DifficultyLevel) => {
      if (!host) {
        console.log("Can't update difficulty, not connected");
        return;
      }

      localPlayer?.performRpc({
        destinationIdentity: host.identity,
        method: "host.update_difficulty",

        // payload is a string, and by convention we are using JSON for this method's parameters
        payload: JSON.stringify({ difficulty }),
      });
    },
    [localPlayer, host]
  );

  // Register a handler for data messages from other participants when the Room is created
  useEffect(() => {
    // We use topics to separate data messages and ensure they are handled correctly
    const handler = (
      payload: Uint8Array,
      participant: RemoteParticipant | undefined,
      kind: DataPacket_Kind | undefined,
      topic: string | undefined
    ) => {
      if (!participant) {
        return;
      }

      // New line drawn by another player. We add it to the local player's copy of their drawing.
      if (topic === "player.draw_line") {
        const line = decodeLine(payload); // Decode the line from the compact binary format
        setDrawings((prev: Map<string, PlayerDrawing>) => {
          const drawing = prev.get(participant.identity) ?? new PlayerDrawing();
          drawing.addLine(line);
          return new Map(prev).set(participant.identity, drawing);
        });

        // The other player has cleared their drawing. We clear the local player's copy of their drawing.
      } else if (topic === "player.clear_drawing") {
        setDrawings((prev: Map<string, PlayerDrawing>) => {
          const drawing = prev.get(participant.identity) ?? new PlayerDrawing();
          drawing.clear();
          return new Map(prev).set(participant.identity, drawing);
        });

        // The host has completed a new round of guesses. We replace our guesses with the new ones.
      } else if (topic === "host.guess") {
        const guesses = new Map<string, string>(
          Object.entries(JSON.parse(new TextDecoder().decode(payload)))
        );
        setGuesses(guesses);
      }
    };

    // Registers the handler
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      // Unregisters the handler when the component unmounts (room has changed)
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  // Register our `player.get_drawing` RPC method on the local player
  useEffect(() => {
    // The handler must be an async function that receives `RpcInvocationData`
    async function handleGetDrawing(data: RpcInvocationData) {
      // The drawing is encoded as a series of lines. Each line is 8 bytes.
      const totalLength = localDrawing.lines.length * 8;
      const buffer = new Uint8Array(totalLength);
      localDrawing.lines.forEach((line, i) => {
        // See the `encodeLine` function in `drawings.ts` for more information
        const encodedLine = encodeLine(line);
        buffer.set(encodedLine, i * 8);
      });

      // RPC payloads must be strings, so we use base64 here which is a safe and efficient way to encode binary data as a string
      return Buffer.from(buffer).toString("base64");
    }

    // Register the handler for the `player.get_drawing` method
    localPlayer?.registerRpcMethod("player.get_drawing", handleGetDrawing);
    return () => {
      // Unregister the RPC method when the component unmounts (localPlayer has changed)
      localPlayer?.unregisterRpcMethod("player.get_drawing");
    };
  }, [localPlayer]);

  // Register our `player.kick` RPC method on the local player
  useEffect(() => {
    // The handler must be an async function that receives `RpcInvocationData`
    async function handleKick(data: RpcInvocationData) {
      // We only allow the host to kick us
      if (data.callerIdentity !== host?.identity) {
        console.log("refusing to be kicked by", data.callerIdentity);
        return "";
      }

      // The payload is a string, and by convention we are using JSON for this method's parameters
      const payload = JSON.parse(data.payload);

      // This method is used to ask the player to leave the room gracefully with a provided reason that is displayed to the player
      console.log("getting kicked due to '%s'", payload.reason);
      setKickReason(payload.reason);

      // Wait a moment before disconnecting to allow the UI to display the kick reason
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Disconnect from the room after a short delay to allow our response to get back to the host
      setTimeout(() => {
        disconnect();
      }, 100);

      // Nothing to return, but this ensures the host won't forcibly disconnect us before we've displayed the kick reason
      return "";
    }
    localPlayer?.registerRpcMethod("player.kick", handleKick);
    return () => {
      localPlayer?.unregisterRpcMethod("player.kick");
    };
  }, [localPlayer]);

  // Register our `player.caught_cheating` RPC method on the local player
  useEffect(() => {
    // The handler must be an async function that receives `RpcInvocationData`
    async function handleCaughtCheating(data: RpcInvocationData) {
      // We only allow the host to accuse us of cheating
      if (data.callerIdentity !== host?.identity) {
        console.log("refusing to be cheated by", data.callerIdentity);
        return "";
      }

      // Set the special visual state to indicate we were caught cheating
      setIsBSOD(true);

      // Return an empty string, there's no need for additional information
      return "";
    }
    // Register the handler for the `player.caught_cheating` method
    localPlayer?.registerRpcMethod(
      "player.caught_cheating",
      handleCaughtCheating
    );
    return () => {
      // Unregister the RPC method when the component unmounts (localPlayer has changed)
      localPlayer?.unregisterRpcMethod("player.caught_cheating");
    };
  }, [localPlayer, host]);

  // Ensure we publish our microphone when our connection state changes
  useEffect(() => {
    if (room.state === ConnectionState.Connected) {
      room.localParticipant.setMicrophoneEnabled(shouldEnableMicrophone);
    }
  }, [shouldEnableMicrophone, room]);

  // Remember the microphone state in local storage
  useEffect(() => {
    const storedValue = localStorage.getItem("shouldEnableMicrophone");
    if (storedValue !== null) {
      setShouldEnableMicrophone(storedValue !== "false");
    }
  }, []);

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
        kickReason,
        shouldEnableMicrophone,
        setShouldEnableMicrophone,
        isBSOD,
      }}
    >
      {/* We manage our own Room instance, rather than using the `<LiveKitRoom />` component, but still need to provide it to LiveKit components that depend on it */}
      <RoomContext.Provider value={room}>{children}</RoomContext.Provider>
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
