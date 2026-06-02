import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Resolve TypeScript source BEFORE any stale compiled .js of the same name.
  // (Default order puts .js first, which would shadow .tsx files.)
  resolve: {
    extensions: [".mts", ".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8001",
      "/ws":  { target: "ws://localhost:8001", ws: true },
    },
  },
});
