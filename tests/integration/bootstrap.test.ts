import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, core, makeUserInOrg, makeAnonClient, cleanup, APP, type OrgUser } from "./_setup";

/**
 * Org bootstrap & sessão (social) — o social não tem identidade no front, mas usa
 * org (via create_org_for_user) p/ escopar as tabelas app_social. Cobre sessão,
 * bootstrap, e anon negado.
 */
describe("Bootstrap & sessão (social)", () => {
  let userA: OrgUser;

  beforeAll(async () => {
    userA = await makeUserInOrg({ role: "admin", orgName: "orgA-boot" });
  });

  afterAll(async () => {
    await cleanup(userA);
  });

  it("signInWithPassword devolve sessão válida", async () => {
    const anon = makeAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email: userA.email, password: userA.password });
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userA.userId);
  });

  it("create_org_for_user cria org + membership admin", async () => {
    const fresh = makeAnonClient();
    const email = `it-social-boot-${Date.now()}@example.test`;
    const password = `Pw!${Date.now()}`;
    const { data: created } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { signup_app: APP, full_name: "Boot" },
    });
    const uid = created!.user!.id;
    let orgId: string | null = null;
    try {
      await fresh.auth.signInWithPassword({ email, password });
      const { data: org, error } = await fresh.schema("core").rpc("create_org_for_user", { _name: "Social", _kind: "personal" });
      expect(error).toBeNull();
      orgId = org as string;
      const { data: mem } = await fresh.schema("core").from("memberships").select("role").eq("user_id", uid);
      expect(mem?.some((m: any) => m.role === "admin")).toBe(true);
    } finally {
      await admin.auth.admin.deleteUser(uid).catch(() => undefined);
      if (orgId) await core().from("organizations").delete().eq("id", orgId).then(() => undefined, () => undefined);
    }
  });

  it("anon não lê app_social.creations nem brand_profiles", async () => {
    const anon = makeAnonClient();
    const { data: c } = await anon.from("creations").select("id");
    const { data: b } = await anon.from("brand_profiles").select("id");
    expect(Array.isArray(c) ? c.length : 0).toBe(0);
    expect(Array.isArray(b) ? b.length : 0).toBe(0);
  });
});
