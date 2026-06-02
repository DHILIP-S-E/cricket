import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { tokenStore } from "../api/api_base";
import { queryClient } from "../lib/query_client";

interface AuthContextValue {
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!tokenStore.get());

  const setTokens = useCallback((accessToken: string, _refreshToken: string) => {
    tokenStore.set(accessToken);
    // refresh token goes to httpOnly cookie via server, or persist separately
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setIsAuthenticated(false);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
