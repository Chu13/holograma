/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Embeddability is a hard product requirement (HOLOGRAMA is meant to run
  // inside an <iframe> on www.jabordones.com) — never add X-Frame-Options
  // or a frame-ancestors CSP here or in vercel.json.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
  },
});
