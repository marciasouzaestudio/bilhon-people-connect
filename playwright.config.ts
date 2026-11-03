import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: "tests/integration/.env.test" });

/** E2E — social. Vite dev :8080 contra o CENTRAL; edges/IA mockadas por rota. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // E2E_CADENCIA=1 é o modo "take de vídeo": grava sempre, em 1280x720 e
    // pt-BR. Sem a env, o mesmo spec roda rápido e só guarda vídeo de falha.
    video: process.env.E2E_CADENCIA ? "on" : "retain-on-failure",
    ...(process.env.E2E_CADENCIA
      ? {
          viewport: { width: 1280, height: 720 },
          locale: "pt-BR",
          timezoneId: "America/Sao_Paulo",
        }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // No modo vídeo sobe o BUILD DE PRODUÇÃO: o dev server compila sob demanda
    // e a primeira navegação de cada rota fica ~8s em branco na gravação (além
    // de não ser o bundle que o cliente recebe).
    command: process.env.E2E_CADENCIA
      ? "npm run build && npx vite preview --port 8080 --strictPort"
      : "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI && !process.env.E2E_CADENCIA,
    timeout: process.env.E2E_CADENCIA ? 180_000 : 60_000,
  },
});
