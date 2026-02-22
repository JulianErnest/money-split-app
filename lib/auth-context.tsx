import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isNewUser: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
  isNewUser: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // Restore persisted session on mount
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        checkIsNewUser(currentSession.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        checkIsNewUser(newSession.user.id);
      } else {
        setIsNewUser(false);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkIsNewUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("display_name, phone_number")
        .eq("id", userId)
        .single();

      if (error || !data || !data.display_name || !data.phone_number) {
        setIsNewUser(true);
      } else {
        setIsNewUser(false);
      }
    } catch {
      // If query fails (row doesn't exist), treat as new user
      setIsNewUser(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshProfile() {
    const userId = session?.user?.id;
    if (userId) {
      await checkIsNewUser(userId);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isNewUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
