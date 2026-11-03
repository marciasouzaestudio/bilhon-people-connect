import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit de src/lib/org.ts (social, modelo go-live "1 deploy = 1 org"):
 * resolve org via INSTÂNCIA (VITE_INSTANCE_ID → org_for_instance/claim_instance;
 * claim negado = accessDenied) OU, sem instância, via membership existente →
 * claim_by_email (provisioning-only: sem provisão pro e-mail → accessDenied).
 * NÃO cria org self-serve (create_org_for_user está trancado no central-43).
 * Supabase mockado + vi.stubEnv.
 */
const h = vi.hoisted(() => ({
  userId: "u1" as string | null,
  membershipOrg: null as string | null,
  byEmail: null as string | null,
  orgForInstance: null as string | null,
  claimed: "org-claimed" as string | null,
  claimError: null as null | { message: string },
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  h.getSession.mockImplementation(async () => ({
    data: { session: h.userId ? { user: { id: h.userId } } : null },
  }));
  h.maybeSingle.mockImplementation(async () => ({
    data: h.membershipOrg ? { org_id: h.membershipOrg } : null,
    error: null,
  }));
  h.rpc.mockImplementation(async (fn: string) => {
    if (fn === "org_for_instance") return { data: h.orgForInstance, error: null };
    if (fn === "claim_instance") return { data: h.claimed, error: h.claimError };
    if (fn === "claim_by_email") return { data: h.byEmail, error: null };
    return { data: null, error: null };
  });
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: h.maybeSingle,
  };
  const schema = () => ({ from: () => builder, rpc: h.rpc });
  return { supabase: { auth: { getSession: h.getSession }, schema } };
});

// social pode expor o client em @/lib/supabase (não @/integrations/...). Cobrimos os 2 nomes.
vi.mock("@/lib/supabase", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: h.maybeSingle,
  };
  const schema = () => ({ from: () => builder, rpc: h.rpc });
  return { supabase: { auth: { getSession: h.getSession }, schema } };
});

import { getCurrentOrgId, requireOrgId, invalidateOrgCache, isInstanceAccessDenied } from "./org";

beforeEach(() => {
  invalidateOrgCache();
  h.userId = "u1";
  h.membershipOrg = null;
  h.byEmail = null;
  h.orgForInstance = null;
  h.claimed = "org-claimed";
  h.claimError = null;
  h.getSession.mockClear();
  h.rpc.mockClear();
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());

describe("org.ts (social) — sem instância (provisioning-only)", () => {
  it("devolve a membership existente (sem RPC)", async () => {
    h.membershipOrg = "org-existing";
    expect(await getCurrentOrgId()).toBe("org-existing");
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("reivindica por e-mail quando não há membership (claim_by_email)", async () => {
    h.byEmail = "org-by-email";
    expect(await getCurrentOrgId()).toBe("org-by-email");
    expect(h.rpc).toHaveBeenCalledWith("claim_by_email", expect.anything());
  });
  it("sem membership e sem provisão pro e-mail → accessDenied + null", async () => {
    h.byEmail = null;
    expect(await getCurrentOrgId()).toBeNull();
    expect(isInstanceAccessDenied()).toBe(true);
    await expect(requireOrgId()).rejects.toThrow(/acesso|organiza/i);
  });
  it("single-flight + cache (getSession 1x)", async () => {
    h.membershipOrg = "org-x";
    await Promise.all([getCurrentOrgId(), getCurrentOrgId()]);
    await getCurrentOrgId();
    expect(h.getSession).toHaveBeenCalledOnce();
  });
});

describe("org.ts (social) — caminho de INSTÂNCIA", () => {
  it("org_for_instance devolve a org", async () => {
    vi.stubEnv("VITE_INSTANCE_ID", "inst-1");
    h.orgForInstance = "org-inst";
    expect(await getCurrentOrgId()).toBe("org-inst");
    expect(isInstanceAccessDenied()).toBe(false);
  });
  it("1º run: claim_instance reivindica", async () => {
    vi.stubEnv("VITE_INSTANCE_ID", "inst-1");
    h.claimed = "org-new-inst";
    expect(await getCurrentOrgId()).toBe("org-new-inst");
    expect(h.rpc).toHaveBeenCalledWith("claim_instance", expect.anything());
  });
  it("claim negado → accessDenied + requireOrgId lança", async () => {
    vi.stubEnv("VITE_INSTANCE_ID", "inst-1");
    h.claimError = { message: "Instância reservada para outro dono" };
    expect(await getCurrentOrgId()).toBeNull();
    expect(isInstanceAccessDenied()).toBe(true);
    invalidateOrgCache();
    vi.stubEnv("VITE_INSTANCE_ID", "inst-1");
    h.claimError = { message: "reservada" };
    await expect(requireOrgId()).rejects.toThrow(/instância|acesso/i);
  });
});
