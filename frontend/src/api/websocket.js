import { useEffect, useRef, useCallback } from "react";
const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
export function useWebSocket(path, onMessage, enabled = true) {
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const stableHandler = useRef(onMessage);
    stableHandler.current = onMessage;
    const connect = useCallback(() => {
        if (!enabled)
            return;
        const ws = new WebSocket(`${WS_BASE}${path}`);
        wsRef.current = ws;
        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.type !== "heartbeat" && data.type !== "pong") {
                    stableHandler.current(data);
                }
            }
            catch {
                // non-JSON message
            }
        };
        ws.onopen = () => {
            // heartbeat every 25s
            const hb = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN)
                    ws.send("ping");
            }, 25000);
            ws.addEventListener("close", () => clearInterval(hb));
        };
        ws.onclose = () => {
            // Reconnect after 3 seconds
            reconnectTimer.current = setTimeout(() => connect(), 3000);
        };
        ws.onerror = () => ws.close();
    }, [path, enabled]);
    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current)
                clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);
}
