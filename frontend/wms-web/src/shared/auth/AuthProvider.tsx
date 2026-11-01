import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { AuthUser } from "@modules/auth";
import { parseJwtExp } from "./jwt";
import { clearAuthSession, redirectToLogin } from "../api/httpClient";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("studio-user");
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("studio-access-token"),
  );

  const timerRef = useRef<number | null>(null);

  const clearExpiryTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleProactiveSignOut = (jwtToken: string) => {
    clearExpiryTimer();
    const exp = parseJwtExp(jwtToken);
    if (!exp) return;

    const expiryMs = exp * 1000;
    const oneMinuteBeforeMs = expiryMs - 60 * 1000;
    const delay = oneMinuteBeforeMs - Date.now();

    if (delay <= 0) {
      // Token is already expired or within 1 minute of expiring
      clearAuthSession();
      setUser(null);
      setToken(null);
      redirectToLogin();
    } else {
      timerRef.current = window.setTimeout(() => {
        clearAuthSession();
        setUser(null);
        setToken(null);
        redirectToLogin();
      }, delay);
    }
  };

  // Handle proactive expiry timer on initial mount or token change
  useEffect(() => {
    const currentToken = localStorage.getItem("studio-access-token");
    if (currentToken && user) {
      scheduleProactiveSignOut(currentToken);
    }

    const handleSignedOutEvent = () => {
      clearExpiryTimer();
      setUser(null);
      setToken(null);
    };

    window.addEventListener("auth:signed-out", handleSignedOutEvent);
    return () => {
      clearExpiryTimer();
      window.removeEventListener("auth:signed-out", handleSignedOutEvent);
    };
  }, [user]);

  const signOut = () => {
    clearExpiryTimer();
    clearAuthSession();
    setUser(null);
    setToken(null);
  };

  const setSession = (newToken: string, nextUser: AuthUser) => {
    localStorage.setItem("studio-access-token", newToken);
    localStorage.setItem("studio-user", JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(newToken);
    scheduleProactiveSignOut(newToken);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: user !== null && Boolean(token),
      setSession,
      signOut,
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
