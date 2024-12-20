"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface UrlRoomNameContextType {
  urlRoomName: string;
  setUrlRoomName: (roomName: string) => void;
}

const UrlRoomNameContext = createContext<UrlRoomNameContextType | undefined>(
  undefined,
);

// A react context that syncs the room name with the URL hash
export function UrlRoomNameProvider({ children }: { children: ReactNode }) {
  const [urlRoomName, setUrlRoomName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hashName = window.location.hash.slice(1);
    if (hashName) {
      setUrlRoomName(hashName);
    } else {
      const roomName = generateRoomName();
      setUrlRoomName(roomName);
      window.location.hash = roomName;
    }

    const handleHashChange = () => {
      setUrlRoomName(window.location.hash.slice(1));
    };

    window.addEventListener("hashchange", handleHashChange);
    setLoaded(true);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loaded) return;

    let name = urlRoomName.trim();
    window.location.hash = name;
  }, [urlRoomName, loaded]);

  return (
    <UrlRoomNameContext.Provider value={{ urlRoomName, setUrlRoomName }}>
      {children}
    </UrlRoomNameContext.Provider>
  );
}

export function useUrlRoomName() {
  const context = useContext(UrlRoomNameContext);
  if (context === undefined) {
    throw new Error("useUrlRoomName must be used within a UrlRoomNameProvider");
  }
  return context;
}

function generateRoomName() {
  return `${Math.round(Math.random() * 999)
    .toString()
    .padStart(3, "0")}-${Math.round(Math.random() * 999)
    .toString()
    .padStart(3, "0")}`;
}
