import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // The default "forks" pool fails to spawn worker processes in this
    // environment ("Timeout waiting for worker to respond") -- "threads"
    // works reliably. backend/'s vitest never hit this (no jsdom/browser
    // environment there); flagged here as an environment-specific fix,
    // not a general vitest recommendation.
    pool: "threads",
  },
});
