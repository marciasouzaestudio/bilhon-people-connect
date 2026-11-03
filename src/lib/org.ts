import { supabase } from "@/integrations/supabase/client";

/**
 * Ponte de tenant do repoint (banco CENTRAL). Resolve o org_id do usuário atual:
 *  - INSTÂNCIA distribuída (env VITE_INSTANCE_ID setado, "1 deploy = 1 org"): resolve a
 *    org da instância (core.org_for_instance) e, no 1º run, reivindica (core.claim_instance).
 *    O banco (central-32) aplica o claim_mode: 'open' (1º a logar vira dono) ou 'assigned'
 *    (só o intended_owner pré-amarrado). Claim negado (instância de outro dono) → sem acesso
 *    (isInstanceAccessDenied() vira true; o app mostra "aguardando acesso").
 *  - Senão (dev/local, sem VITE_INSTANCE_ID): garante uma org PESSOAL (core.create_org_for_user).
 * Idempotente + single-flight; cache invalidado no sign-out.
 */
const SOLUTION = (import.meta.env.VITE_SOLUTION as string) || "social";
const PERSONAL_ORG_NAME = "Social";

let _orgIdCache: string | null = null;
let _orgIdPromise: Promise<string | null> | null = null;
let _accessDenied = false;

export function invalidateOrgCache() {
  _orgIdCache = null;
  _orgIdPromise = null;
  _accessDenied = false;
}

/** true quando a instância pertence a outro dono (claim negado) → tela "aguardando acesso". */
export function isInstanceAccessDenied(): boolean {
  return _accessDenied;
}

function deployOrigin(): string | undefined {
  return typeof window !== "undefined" && window.location ? window.location.origin : undefined;
}

async function resolveOrgId(): Promise<string | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;

  const instanceId = ((import.meta.env.VITE_INSTANCE_ID as string) || "").trim();
  if (instanceId) {
    // instância distribuída: já é membro? devolve a org da instância
    const { data: existing } = await supabase
      .schema("core")
      .rpc("org_for_instance", { _instance_id: instanceId });
    if (existing) { _accessDenied = false; return existing as string; }
    // 1º run: reivindica (o banco aplica open/assigned)
    const { data: claimed, error } = await supabase
      .schema("core")
      .rpc("claim_instance", { _instance_id: instanceId, _solution: SOLUTION, _deploy_url: deployOrigin() });
    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("reservada") || m.includes("reivindicada")) { _accessDenied = true; return null; }
      throw error;
    }
    _accessDenied = false;
    return (claimed as string | null) ?? null;
  }

  // dev/local: org pessoal (fallback)
  const { data: mem } = await supabase
    .schema("core")
    .from("memberships")
    .select("org_id")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const existing = (mem as { org_id?: string } | null)?.org_id ?? null;
  if (existing) return existing;

  // CASO USUARIO FINAL: instancia pre-provisionada pro EMAIL da compra (central-35).
  const { data: byEmail } = await supabase.schema("core").rpc("claim_by_email", { _solution: SOLUTION });
  if (byEmail) return byEmail as string;
  // Provisioning-only (go-live): sem instância provisionada pro email → SEM org pessoal.
  // Signup aberto não cria org; só provisão. O app mostra "aguardando acesso".
  _accessDenied = true;
  return null;
}

export async function getCurrentOrgId(): Promise<string | null> {
  if (_orgIdCache) return _orgIdCache;
  if (_orgIdPromise) return _orgIdPromise;
  _orgIdPromise = resolveOrgId()
    .then((id) => { _orgIdCache = id; return id; })
    .catch((e) => { _orgIdPromise = null; throw e; });
  return _orgIdPromise;
}

export async function requireOrgId(): Promise<string> {
  const id = await getCurrentOrgId();
  if (!id) {
    if (_accessDenied) throw new Error("Sem acesso a esta instância (pertence a outro dono).");
    throw new Error("Sem organização para o usuário atual (sessão expirada?).");
  }
  return id;
}
