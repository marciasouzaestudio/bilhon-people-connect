import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * social_creative-image — geração da ARTE dos criativos (OpenAI gpt-image).
 *
 * Função dedicada do módulo Criativos (isolada do social_openai-image do Studio
 * para não mexer no caminho de produção dos posts). Diferença principal:
 * aceita `referenceImages` (URLs http das fotos do produto e/ou logo da marca)
 * e, quando presentes, usa o endpoint /images/edits — a arte sai com o
 * PRODUTO REAL e o LOGO REAL em vez de uma invenção do modelo.
 *
 * Hardening (mesmo padrão do social_openai-image do central):
 *  - verify_jwt=true + getUser() → só autenticado gera imagem paga.
 *  - rate-limit por usuário (20/min: um conjunto gera vários formatos em lote).
 *  - Cota persistida por organização (feature compartilhada "openai_image")
 *    reservada ANTES de falar com a OpenAI; liberada se falhar.
 *  - Chave OpenAI resolvida SÓ no servidor: Vault → env.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const IMAGE_COST_MICROUSD = 42_000;
const IMAGE_FEATURE = "openai_image";
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RL = new Map<string, number[]>();
function rateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (RL.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { RL.set(key, hits); return false; }
  hits.push(now); RL.set(key, hits); return true;
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function resolveOrgId(userId: string): Promise<string | null> {
  const { data, error } = await admin()
    .schema("core")
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.org_id ?? null;
}

interface QuotaResult {
  allowed: boolean;
  motivo?: "diario" | "mensal";
  usado_dia: number;
  limite_dia: number;
  usado_mes: number;
  limite_mes: number;
  reset_dia?: string;
  reset_mes?: string;
}

async function reserveQuota(orgId: string, userId: string, units: number): Promise<QuotaResult> {
  const { data, error } = await admin().schema("app_social").rpc("reserve_ai_quota", {
    _org_id: orgId, _user_id: userId, _feature: IMAGE_FEATURE, _units: units,
  });
  if (error) throw error;
  return data as QuotaResult;
}

async function releaseQuota(orgId: string, units: number): Promise<void> {
  const { error } = await admin().schema("app_social").rpc("release_ai_quota", {
    _org_id: orgId, _feature: IMAGE_FEATURE, _units: units,
  });
  if (error) console.error("[social_creative-image] quota release failed:", error.message);
}

async function recordGeneration(params: {
  orgId: string; userId: string; model: string; units: number; costMicrousd: number;
  status: "ok" | "erro" | "negado"; errorMessage?: string;
}): Promise<void> {
  const { error } = await admin().schema("app_social").rpc("record_ai_generation", {
    _org_id: params.orgId, _user_id: params.userId, _feature: IMAGE_FEATURE, _provider: "openai",
    _model: params.model, _units: params.units, _custo_estimado_microusd: params.costMicrousd,
    _status: params.status, _error_message: params.errorMessage ?? null,
  });
  if (error) console.error("[social_creative-image] usage record failed:", error.message);
}

function formatReset(reset: string | undefined): string {
  if (!reset) return "o próximo período";
  const [year, month, day] = reset.split("-").map(Number);
  if (!year || !month || !day) return reset;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function quotaMessage(quota: QuotaResult): string {
  if (quota.motivo === "mensal") {
    return `Cota de imagens da sua organização esgotada — ${quota.usado_mes}/${quota.limite_mes} este mês. Volta em ${formatReset(quota.reset_mes)}.`;
  }
  return `Cota de imagens da sua organização esgotada — ${quota.usado_dia}/${quota.limite_dia} hoje. Volta em ${formatReset(quota.reset_dia)}.`;
}

async function resolveOpenAiKey(): Promise<string | null> {
  try {
    const { data, error } = await admin().schema("app_social").rpc("get_vault_secret", { secret_name: "OPENAI_API_KEY" });
    if (!error && typeof data === "string" && data) return data;
  } catch (e) {
    console.error("[social_creative-image] vault lookup failed:", e instanceof Error ? e.message : e);
  }
  return Deno.env.get("OPENAI_API_KEY") ?? null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Baixa uma imagem de referência (http/https) e devolve como Blob para o multipart. */
async function fetchReference(url: string): Promise<Blob> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Imagem de referência precisa ser uma URL http(s).");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não consegui baixar a imagem de referência (HTTP ${res.status}).`);
  const type = res.headers.get("content-type") || "image/png";
  if (!type.startsWith("image/")) throw new Error("A referência informada não é uma imagem.");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_REFERENCE_BYTES) throw new Error("Imagem de referência muito grande (máx. 12 MB).");
  return new Blob([buf], { type });
}

interface RequestBody {
  prompt: string;
  size?: string;              // "1024x1024" | "1024x1536" | "1536x1024"
  n?: number;
  model?: string;
  quality?: string;           // low | medium | high (high vira medium: limite de 150s)
  referenceImages?: string[]; // URLs http das fotos do produto / logo
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Não autorizado" }, 401);
  if (!rateLimit(`creative-image:${user.id}`)) {
    return json({ error: "Muitas gerações em pouco tempo. Aguarde alguns segundos." }, 429);
  }

  let orgId: string | null = null;
  let reservedUnits = 0;
  let requestModel = DEFAULT_IMAGE_MODEL;

  try {
    orgId = await resolveOrgId(user.id);
    if (!orgId) return json({ error: "Sua conta não está vinculada a nenhuma organização." }, 403);

    const body: RequestBody = await req.json();
    const { prompt, size = "1024x1024", n = 1, model, quality, referenceImages = [] } = body;
    if (!prompt?.trim()) return json({ error: "Missing 'prompt'" }, 400);
    if (!Number.isInteger(n) || n < 1 || n > 4) return json({ error: "'n' deve ser um inteiro entre 1 e 4." }, 400);
    if (!["1024x1024", "1024x1536", "1536x1024"].includes(size)) return json({ error: "size inválido." }, 400);
    if (!Array.isArray(referenceImages) || referenceImages.length > MAX_REFERENCE_IMAGES) {
      return json({ error: `No máximo ${MAX_REFERENCE_IMAGES} imagens de referência.` }, 400);
    }
    requestModel = model || DEFAULT_IMAGE_MODEL;

    const quota = await reserveQuota(orgId, user.id, n);
    if (!quota.allowed) {
      const message = quotaMessage(quota);
      await recordGeneration({ orgId, userId: user.id, model: requestModel, units: n, costMicrousd: 0, status: "negado", errorMessage: message });
      return json({
        error: message, code: "quota_exceeded", motivo: quota.motivo,
        usado_dia: quota.usado_dia, limite_dia: quota.limite_dia,
        usado_mes: quota.usado_mes, limite_mes: quota.limite_mes,
        reset_dia: quota.reset_dia, reset_mes: quota.reset_mes,
      }, 429);
    }
    reservedUnits = n;

    const apiKey = await resolveOpenAiKey();
    if (!apiKey) throw new Error("OPENAI_API_KEY não disponível (Vault/secret).");

    const safeQuality = quality === "high" ? "medium" : (quality || "medium");
    const useEdits = referenceImages.length > 0;

    console.log(`[social_creative-image] user=${user.id} org=${orgId} model=${requestModel} size=${size} n=${n} refs=${referenceImages.length}`);

    // Monta a request: JSON para /generations, multipart para /edits (com referências).
    let endpoint = "https://api.openai.com/v1/images/generations";
    let makeInit: () => RequestInit;
    if (useEdits) {
      endpoint = "https://api.openai.com/v1/images/edits";
      const blobs = await Promise.all(referenceImages.map(fetchReference));
      makeInit = () => {
        const form = new FormData();
        form.append("model", requestModel);
        form.append("prompt", prompt);
        form.append("n", String(n));
        form.append("size", size);
        form.append("quality", safeQuality);
        blobs.forEach((b, i) => form.append("image[]", b, `ref-${i + 1}.${b.type.split("/")[1] || "png"}`));
        return { method: "POST", headers: { "Authorization": `Bearer ${apiKey}` }, body: form };
      };
    } else {
      const payload = { model: requestModel, prompt, n, size, quality: safeQuality };
      makeInit = () => ({
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    // Retry curto para instabilidade upstream (5xx).
    const RETRY_DELAYS_MS = [1000, 3000];
    let resp: Response | null = null;
    let networkError: string | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        console.warn(`[social_creative-image] retry ${attempt}/${RETRY_DELAYS_MS.length} após ${networkError ?? `HTTP ${resp?.status}`}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        resp = await fetch(endpoint, makeInit());
        networkError = null;
      } catch (e) {
        networkError = e instanceof Error ? e.message : String(e);
        resp = null;
        continue;
      }
      if (resp.status < 500) break;
    }

    if (!resp) throw new Error("Instabilidade na OpenAI. Tente novamente em instantes.");

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[social_creative-image] OpenAI error:", resp.status, errText);
      let message = `OpenAI ${resp.status}`;
      try { message = JSON.parse(errText)?.error?.message || message; } catch { /* keep status */ }
      if (resp.status === 401) message = "Chave OpenAI inválida.";
      if (resp.status === 429) message = "Limite de taxa ou créditos OpenAI excedido.";
      if (resp.status >= 500) message = "Instabilidade na OpenAI. Tente novamente em instantes.";
      throw new Error(message);
    }

    const data = await resp.json();
    const images: string[] = (data.data || [])
      .map((item: { b64_json?: string; url?: string }) =>
        item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url)
      .filter(Boolean);
    if (!images.length) throw new Error("A OpenAI não devolveu imagem.");

    await recordGeneration({ orgId, userId: user.id, model: requestModel, units: n, costMicrousd: n * IMAGE_COST_MICROUSD, status: "ok" });
    reservedUnits = 0;
    return json({ images, model: requestModel, mode: useEdits ? "edits" : "generations" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[social_creative-image] error:", message);
    const errorCode = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (errorCode === "42501" && reservedUnits === 0) {
      return json({ error: "Sua organização não possui acesso ativo ao Social." }, 403);
    }
    if (orgId && reservedUnits > 0) {
      await releaseQuota(orgId, reservedUnits);
      await recordGeneration({ orgId, userId: user.id, model: requestModel, units: reservedUnits, costMicrousd: 0, status: "erro", errorMessage: message });
    }
    return json({ error: message }, 502);
  }
});
