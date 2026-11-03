import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globals: true,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["dotenv/config"],
    env: { DOTENV_CONFIG_PATH: "tests/integration/.env.test" },
  },
});
