import { test, expect } from "./fixtures";

test.describe("Autenticação & rotas protegidas (social)", () => {
  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login com credenciais válidas entra no app", async ({ page, seedUser, login }) => {
    const admin = await seedUser("admin");
    await login(page, admin);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("login com credenciais inválidas permanece em /login", async ({ page, seedUser }) => {
    const admin = await seedUser("admin");
    await page.goto("/login");
    await page.locator("#email").fill(admin.email);
    await page.locator("#password").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#password")).toBeVisible();
  });
});
