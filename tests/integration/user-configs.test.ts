import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeUserInOrg, cleanup, type OrgUser } from "./_setup";

/**
 * user_configs (social) — as API-keys de terceiros que o USUÁRIO configura (Post for Me,
 * Anthropic, ...). Cobre o RELAX central-13 (own_insert/select/update: user_id=auth.uid()):
 * usuário grava/lê a própria key; outro usuário (mesmo org) NÃO lê (per-user).
 */
describe("user_configs (relax central-13, per-user)", () => {
  let admin: OrgUser;
  let member: OrgUser; // mesmo org, mas config é per-user

  beforeAll(async () => {
    admin = await makeUserInOrg({ role: "admin", orgName: "orgA-cfg" });
    member = await makeUserInOrg({ role: "agent", orgId: admin.orgId });
  });

  afterAll(async () => {
    await cleanup(admin, member);
  });

  it("usuário grava e lê a PRÓPRIA postforme_api_key (relax)", async () => {
    const { error: eIns } = await admin.orgClient
      .from("user_configs")
      .insert({ org_id: admin.orgId, user_id: admin.userId, postforme_api_key: "pfm_secret" });
    expect(eIns).toBeNull();
    const { data, error } = await admin.orgClient
      .from("user_configs")
      .select("user_id, postforme_api_key")
      .eq("user_id", admin.userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.postforme_api_key).toBe("pfm_secret");
  });

  it("outro membro da MESMA org NÃO lê a config do admin (per-user own_select)", async () => {
    const { data } = await member.orgClient
      .from("user_configs")
      .select("user_id, postforme_api_key")
      .eq("user_id", admin.userId);
    expect((data ?? []).length).toBe(0);
  });
});
