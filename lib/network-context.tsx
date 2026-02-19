import React, { createContext, useContext } from "react";
import { useNetInfo } from "@react-native-community/netinfo";

interface NetworkContextValue {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const netInfo = useNetInfo();

  // Treat null/unknown as online to avoid false positives on app start
  const isOnline =
    netInfo.type === "unknown" || netInfo.isConnected !== false;

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
