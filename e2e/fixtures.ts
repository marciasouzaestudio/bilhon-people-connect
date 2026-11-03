import { test as base, type Page, expect } from "@playwright/test";
import { makeUserInOrg, cleanup, seedUserConfig, type OrgUser, type AppRole } from "../tests/integration/_setup";

/**
 * Fixtures E2E (social) — seed via service_role no central (+ user_configs onboarded p/
 * passar o RequireOnboarding) + teardown; login real (/login); edges/IA mockadas.
 */
type Fixtures = {
  seedUser: (role?: AppRole) => Promise<OrgUser>;
  login: (page: Page, u: OrgUser) => Promise<void>;
  mockEdges: (page: Page) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  seedUser: async ({}, use) => {
    const created: OrgUser[] = [];
    await use(async (role: AppRole = "admin") => {
      const u = await makeUserInOrg({ role });
      // onboarding completo p/ chegar no /dashboard (RequireOnboarding)
      await seedUserConfig(u.orgId, u.userId, { onboarding_completed: true, brand_name: "E2E" }).catch(() => undefined);
      created.push(u);
      return u;
    });
    await cleanup(...created);
  },

  login: async ({}, use) => {
    await use(async (page: Page, u: OrgUser) => {
      await page.goto("/login");
      await page.locator("#email").fill(u.email);
      await page.locator("#password").fill(u.password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });
  },

  mockEdges: async ({}, use) => {
    await use(async (page: Page) => {
      await page.route("**/functions/v1/**", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
      });
    });
  },
});

export { expect };
