"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, signInWithGoogle, signOut, getAccessToken } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

export interface CookUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

interface AuthContextType {
  user: CookUser | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CookUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            (session.user.email ? session.user.email.split("@")[0] : "Creator"),
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            "",
        });
      } else {
        // Check for local demo session
        const demo = typeof window !== "undefined" ? localStorage.getItem("cook_demo_session") : null;
        if (demo) {
          try {
            const parsed = JSON.parse(demo);
            setUser({
              id: parsed.id,
              email: parsed.email,
              full_name: parsed.user_metadata?.full_name || "COOK Creator",
              avatar_url: parsed.user_metadata?.avatar_url || "",
            });
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    // 2. Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            (session.user.email ? session.user.email.split("@")[0] : "Creator"),
          avatar_url:
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            "",
        });
      } else {
        const demo = typeof window !== "undefined" ? localStorage.getItem("cook_demo_session") : null;
        if (!demo) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
