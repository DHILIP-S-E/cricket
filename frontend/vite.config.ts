import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8001",
      "/ws":  { target: "ws://localhost:8001", ws: true },
    },
  },
});
