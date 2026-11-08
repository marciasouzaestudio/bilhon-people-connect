/**
 * Shared internals for the API service layer.
 *
 * Fallback embutido: as creds do projeto são públicas (anon key, protegida por RLS).
 * Sem fallback, builds publicados onde a env não foi injetada quebram com
 * "VITE_SUPABASE_URL não configurada".
 */

import { supabase } from "@/lib/app-db-client";
import { userStorage } from "@/lib/storage";
import type { AppConfig } from "@/types";

const FALLBACK_SUPABASE_URL = "https://auytmefqnuzbktyzcled.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1eXRtZWZxbnV6Ymt0eXpjbGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTc4MjYsImV4cCI6MjA5ODIzMzgyNn0.zIRr-xM3Z_nM3xkOKWp6J3uCRVi_fWeiGvxZlOh7Rok";

export function getSupabaseUrl(): string {
  return (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
}

/** Read user's saved config from scoped localStorage */
export function getSavedConfig(): Partial<AppConfig> {
  try {
    const raw = userStorage.get("config");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function getAnonKey(): string {
  return (
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    FALLBACK_ANON_KEY
  );
}

/**
 * As chaves NOVAS do Supabase (`sb_publishable_…` / `sb_secret_…`) são strings opacas,
 * não JWTs. Mandá-las também no `Authorization` faz o gateway recusar a chamada:
 *
 *   401 {"message":"Conflicting API keys","hint":"The `apikey` and `Authorization`
 *        headers provide conflicting API keys. Send the intended sb_ key only in the
 *        `apikey` header."}
 *
 * O wrapper do client (`src/integrations/supabase/client.ts`) já trata isso, mas a guarda
 * dele NÃO alcança os `fetch` crus que passam por aqui — e são 8 módulos de API.
 */
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function baseHeaders(): Record<string, string> {
  const anonKey = getAnonKey();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (anonKey) {
    h["apikey"] = anonKey;
    // Chave nova vai SÓ no apikey. Chave legada (JWT) mantém o comportamento antigo,
    // que as edges ainda aceitam como portador anônimo.
    if (!isNewSupabaseApiKey(anonKey)) {
      h["Authorization"] = `Bearer ${anonKey}`;
    }
  }
  return h;
}

/**
 * Headers com o JWT da sessão do usuário no Authorization (exigido por edges
 * com verify_jwt=true — ex.: social_openai-image, social_autopilot-run).
 * Sem sessão, mantém a anon key como fallback (a borda responderá 401).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const h = baseHeaders();
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  } catch { /* mantém anon */ }
  return h;
}
