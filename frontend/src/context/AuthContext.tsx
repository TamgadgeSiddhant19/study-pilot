"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  getAuthMe,
  loginUser,
  loginDemoUser,
  registerUser,
  logoutUser,
  updateAuthProfile,
  setStoredToken,
  getStoredToken,
} from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginPayload) => Promise<AuthUser>;
  loginDemo: () => Promise<AuthUser>;
  register: (data: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Sequence ref to prevent race conditions with out-of-order in-flight requests
  const refreshSeqRef = useRef<number>(0);
  const lastAuthActionTimeRef = useRef<number>(0);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const currentSeq = ++refreshSeqRef.current;
    try {
      const currentUser = await getAuthMe();
      if (currentSeq === refreshSeqRef.current) {
        setUser(currentUser);
      }
    } catch {
      // Only clear session if this sequence is still current AND the token hasn't changed
      if (currentSeq === refreshSeqRef.current && getStoredToken() === token) {
        // Protect against clearing if user just performed a fresh login within 2.5s
        if (Date.now() - lastAuthActionTimeRef.current > 2500) {
          setUser(null);
          setStoredToken(null);
        }
      }
    } finally {
      if (currentSeq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleExpired = (e: Event) => {
      const customEvent = e as CustomEvent<{ token?: string }>;
      const failedToken = customEvent.detail?.token;
      const currentToken = getStoredToken();

      // If a login just took place within the last 2.5s, ignore lagging expired events from pre-login calls
      if (Date.now() - lastAuthActionTimeRef.current < 2500) {
        return;
      }

      // If the expired token doesn't match current token, ignore stale event
      if (failedToken && currentToken && failedToken !== currentToken) {
        return;
      }

      setUser(null);
      setStoredToken(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        router.push("/login");
      }
    };

    window.addEventListener("studypilot-auth-expired", handleExpired as EventListener);
    return () => window.removeEventListener("studypilot-auth-expired", handleExpired as EventListener);
  }, [router]);

  const login = async (data: LoginPayload): Promise<AuthUser> => {
    refreshSeqRef.current++;
    lastAuthActionTimeRef.current = Date.now();
    const res = await loginUser(data);
    setUser(res.user);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("studypilot-user-changed"));
    }
    return res.user;
  };

  const loginDemo = async (): Promise<AuthUser> => {
    refreshSeqRef.current++;
    lastAuthActionTimeRef.current = Date.now();
    const res = await loginDemoUser();
    setUser(res.user);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("studypilot-user-changed"));
    }
    return res.user;
  };

  const register = async (data: RegisterPayload): Promise<AuthUser> => {
    refreshSeqRef.current++;
    lastAuthActionTimeRef.current = Date.now();
    const res = await registerUser(data);
    setUser(res.user);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("studypilot-user-changed"));
    }
    return res.user;
  };

  const logout = async () => {
    refreshSeqRef.current++;
    lastAuthActionTimeRef.current = Date.now();
    try {
      await logoutUser();
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setStoredToken(null);
      setLoading(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("studypilot-logout"));
        window.dispatchEvent(new CustomEvent("studypilot-user-changed"));
      }
      router.push("/login");
    }
  };

  const updateProfile = async (data: Partial<AuthUser>): Promise<AuthUser> => {
    const updated = await updateAuthProfile(data);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        loginDemo,
        register,
        logout,
        updateProfile,
        refreshUser,
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
