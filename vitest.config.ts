import path from "path";
import { defineConfig } from "vitest/config";

// Standalone Vitest config. Deliberately does not extend vite.config.ts,
// which sets root to client/ - tests live across tests/, shared/, server/
// and client/src/.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "shared/**/*.test.ts",
      "server/**/*.test.ts",
      "client/src/**/*.test.{ts,tsx}",
    ],
    environment: "node",
  },
});
