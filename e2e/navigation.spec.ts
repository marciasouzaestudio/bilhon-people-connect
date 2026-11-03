import { test, expect } from "./fixtures";

/** Navegação autenticada (social) — rotas do shell renderizam com admin logado + mocks. */
const ROUTES = ["/dashboard", "/studio", "/gallery", "/brands", "/schedule", "/sources", "/autopilot"];

test.describe("Navegação autenticada (social)", () => {
  test("rotas do shell renderizam com admin logado", async ({ page, seedUser, login, mockEdges }) => {
    await mockEdges(page);
    const admin = await seedUser("admin");
    await login(page, admin);

    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByText(/página não encontrada|not found|404/i)).toHaveCount(0);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
