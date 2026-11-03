import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeUserInOrg, cleanup, type OrgUser } from "./_setup";

/**
 * Creations (social) — tenancy híbrida: ESCRITA é own (user_id=auth.uid()), LEITURA é
 * org-scoped (membros da org leem). org_id explícito (sem default_org). Cobre own-insert,
 * org-read entre 2 membros, e deny cross-tenant.
 */
describe("Creations (own-write / org-read)", () => {
  let admin: OrgUser;
  let member: OrgUser; // mesmo org
  let outsider: OrgUser; // outra org

  beforeAll(async () => {
    admin = await makeUserInOrg({ role: "admin", orgName: "orgA-cre" });
    member = await makeUserInOrg({ role: "agent", orgId: admin.orgId });
    outsider = await makeUserInOrg({ role: "admin", orgName: "orgB-cre" });
  });

  afterAll(async () => {
    await cleanup(admin, member, outsider);
  });

  it("own-insert: usuário cria a PRÓPRIA creation (user_id=self, org explícito)", async () => {
    const { data, error } = await admin.orgClient
      .from("creations")
      .insert({ org_id: admin.orgId, user_id: admin.userId, type: "image", prompt: "gato astronauta" })
      .select("id, org_id, user_id")
      .single();
    expect(error).toBeNull();
    expect(data?.org_id).toBe(admin.orgId);
    expect(data?.user_id).toBe(admin.userId);
  });

  it("own-insert NÃO deixa forjar user_id de outro", async () => {
    const { error } = await admin.orgClient
      .from("creations")
      .insert({ org_id: admin.orgId, user_id: member.userId, type: "image" }); // user_id != caller
    expect(error).not.toBeNull(); // own_insert exige user_id=auth.uid()
  });

  it("org-read: outro membro da MESMA org lê as creations da org", async () => {
    const { data, error } = await member.orgClient
      .from("creations")
      .select("id, org_id, user_id")
      .eq("org_id", admin.orgId);
    expect(error).toBeNull();
    expect((data ?? []).some((c: any) => c.user_id === admin.userId)).toBe(true); // vê a do admin
  });

  it("deny cross-tenant: org B não lê creations da org A", async () => {
    const { data } = await outsider.orgClient.from("creations").select("id").eq("org_id", admin.orgId);
    expect((data ?? []).length).toBe(0);
  });
});
