import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/terminals": "http://localhost:4242",
      "/extensions": "http://localhost:4242",
      "/ai-processes": "http://localhost:4242",
      "/memory": "http://localhost:4242",
      "/oom-events": "http://localhost:4242",
      "/health": "http://localhost:4242",
      "/metrics": "http://localhost:4242",
    },
  },
});
