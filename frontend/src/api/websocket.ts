import { useCallback, useEffect, useRef } from "react";

// Default to the page origin so Vite's /ws proxy (→ backend) is used in dev.
// Override with VITE_WS_URL for a direct backend connection if needed.
function wsBase(): string {
  const env = import.meta.env.VITE_WS_URL;
  if (env) return env;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

type MessageHandler = (data: Record<string, unknown>) => void;
type SendFn = (data: unknown) => void;

/**
 * Connect to a WebSocket room with auto-reconnect. Returns a `send` function
 * for outbound messages (objects are JSON-encoded). Heartbeat/pong frames are
 * filtered out before reaching `onMessage`.
 */
export function useWebSocket(
  path: string,
  onMessage: MessageHandler,
  enabled = true,
): { send: SendFn } {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableHandler = useRef(onMessage);
  stableHandler.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled) return;

    const ws = new WebSocket(`${wsBase()}${path}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        if (data.type !== "heartbeat" && data.type !== "pong") {
          stableHandler.current(data);
        }
      } catch {
        // non-JSON message
      }
    };

    ws.onopen = () => {
      const hb = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25000);
      ws.addEventListener("close", () => clearInterval(hb));
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => ws.close();
  }, [path, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback<SendFn>((data) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }, []);

  return { send };
}
