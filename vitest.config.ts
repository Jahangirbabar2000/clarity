import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "__tests__/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/ai/**"],
      exclude: ["**/*.test.ts", "lib/ai/insights-generator.ts", "lib/ai/ticket-builder.ts"],
    },
  },
});
