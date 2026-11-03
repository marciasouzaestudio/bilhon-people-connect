/**
 * Harness de INTEGRAÇÃO — app "social" (schema `app_social`), modelo ORG-SCOPED contra
 * o banco CENTRAL (`auytmefqnuzbktyzcled`).
 *
 * Tenancy híbrida do social (pós-repoint):
 *   - todas as tabelas têm org_id + user_id.
 *   - ESCRITA é own (policies *_own_insert: user_id=auth.uid()); LEITURA é org-scoped
 *     (creations_org_select: membros da org leem). user_configs é per-user (own_select).
 *   - NÃO há trigger default_org → org_id é setado EXPLÍCITO (front seta; seed também).
 *
 * Env em `.env.test` (TEST_SUPABASE_*), gitignored. Cada teste isola/derruba a própria org.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const APP = "social" as const;
export const APP_SCHEMA = "app_social" as const;
export const CORE_SCHEMA = "core" as const;

export type AppRole = "admin" | "supervisor" | "agent";

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE_ROLE) {
  throw new Error("[tests/integration] Faltam TEST_SUPABASE_* em tests/integration/.env.test (central).");
}
export const SUPABASE_URL = URL;
export const SUPABASE_ANON_KEY = ANON;

export const admin: SupabaseClient = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function makeAnonClient(schema: string = APP_SCHEMA): SupabaseClient {
  return createClient(URL!, ANON!, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const core = () => admin.schema(CORE_SCHEMA);
export const app = () => admin.schema(APP_SCHEMA);

const rand = () => randomUUID().slice(0, 8);

export interface OrgUser {
  userId: string;
  orgId: string;
  email: string;
  password: string;
  role: AppRole;
  orgClient: SupabaseClient;
}
export interface MakeUserOpts {
  app?: string;
  role?: AppRole;
  orgName?: string;
  orgId?: string;
}

export async function makeUserInOrg(opts: MakeUserOpts = {}): Promise<OrgUser> {
  const role: AppRole = opts.role ?? "agent";
  const appName = opts.app ?? APP;

  let orgId = opts.orgId;
  if (!orgId) {
    const { data: org, error: orgErr } = await core()
      .from("organizations")
      .insert({ name: opts.orgName ?? `org-${APP}-${rand()}` })
      .select("id")
      .single();
    if (orgErr) throw new Error(`makeUserInOrg: core.organizations: ${orgErr.message}`);
    orgId = org.id;
  }

  const email = `it-${APP}-${rand()}@example.test`;
  const password = `Pw!${randomUUID()}`;
  const fullName = `IT ${role} ${rand()}`;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { signup_app: appName, full_name: fullName },
  });
  if (userErr || !created?.user) {
    if (!opts.orgId) await core().from("organizations").delete().eq("id", orgId);
    throw new Error(`makeUserInOrg: createUser: ${userErr?.message}`);
  }
  const userId = created.user.id;

  const { error: memErr } = await core()
    .from("memberships")
    .upsert({ user_id: userId, org_id: orgId, role }, { onConflict: "user_id,org_id" });
  if (memErr) throw new Error(`makeUserInOrg: core.memberships: ${memErr.message}`);

  await core().from("roles").delete().eq("user_id", userId).eq("app", appName);
  const { error: roleErr } = await core().from("roles").insert({ user_id: userId, app: appName, role });
  if (roleErr) throw new Error(`makeUserInOrg: core.roles: ${roleErr.message}`);

  const orgClient = makeAnonClient();
  const { error: signInErr } = await orgClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`makeUserInOrg: signIn: ${signInErr.message}`);

  return { userId, orgId: orgId!, email, password, role, orgClient };
}

export async function cleanup(...users: Array<{ userId?: string; orgId?: string } | null | undefined>) {
  const orgIds = new Set<string>();
  for (const u of users) {
    if (!u) continue;
    if (u.userId) await admin.auth.admin.deleteUser(u.userId).catch(() => undefined);
    if (u.orgId) orgIds.add(u.orgId);
  }
  for (const orgId of orgIds) {
    await core().from("organizations").delete().eq("id", orgId).then(() => undefined, () => undefined);
  }
}

// ---------------------------------------------------------------------------
// Seed helpers (service-role) — org_id + user_id EXPLÍCITOS (sem default_org).
// ---------------------------------------------------------------------------
export async function seedCreation(orgId: string, userId: string): Promise<{ id: string }> {
  const { data, error } = await app()
    .from("creations")
    .insert({ org_id: orgId, user_id: userId, type: "image", prompt: `p ${rand()}` })
    .select("id")
    .single();
  if (error) throw new Error(`seedCreation: ${error.message}`);
  return { id: data.id };
}

export async function seedBrandProfile(orgId: string, userId: string): Promise<{ id: string }> {
  const { data, error } = await app()
    .from("brand_profiles")
    .insert({ org_id: orgId, user_id: userId, name: `Marca ${rand()}` })
    .select("id")
    .single();
  if (error) throw new Error(`seedBrandProfile: ${error.message}`);
  return { id: data.id };
}

export async function seedUserConfig(
  orgId: string,
  userId: string,
  extra: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const { data, error } = await app()
    .from("user_configs")
    .insert({ org_id: orgId, user_id: userId, ...extra })
    .select("id")
    .single();
  if (error) throw new Error(`seedUserConfig: ${error.message}`);
  return { id: data.id };
}

export { rand };
