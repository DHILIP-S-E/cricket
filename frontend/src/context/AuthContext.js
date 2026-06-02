import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from "react";
import { tokenStore } from "../api/api_base";
import { queryClient } from "../lib/query_client";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!tokenStore.get());
    const setTokens = useCallback((accessToken, _refreshToken) => {
        tokenStore.set(accessToken);
        // refresh token goes to httpOnly cookie via server, or persist separately
        setIsAuthenticated(true);
    }, []);
    const logout = useCallback(() => {
        tokenStore.clear();
        setIsAuthenticated(false);
        queryClient.clear();
    }, []);
    return (_jsx(AuthContext.Provider, { value: { isAuthenticated, setTokens, logout }, children: children }));
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
