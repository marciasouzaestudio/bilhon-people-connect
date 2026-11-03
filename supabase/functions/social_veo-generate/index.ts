import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Vídeo via Gemini Omni Flash (Interactions API) — text-to-video. O Veo 3.1 preview
 * foi desligado pelo Google em 22/10/2026; os nomes "veo_*" ficaram por compatibilidade.
 *
 * Tools:
 *   - veo_text_to_video_direct → cria a interação em background e retorna
 *                                { request_id: "interactions/<id>", status: "queued" }
 *   - veo_status               → devolve { status, video?: { url } }
 *
 * Exige o JWT do usuário (org e cota por organização). O mp4 pronto vai pro bucket
 * público "media" para não expor a GEMINI_API_KEY no navegador.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OMNI_MODEL = "gemini-omni-1.1-flash";
const VEO_FEATURE = "veo_video";
// Estimativa herdada do Veo 3.1 (US$ 3,20 por vídeo de 8s); o Omni não publicou preço por segundo.
const VEO_8S_COST_MICROUSD = 3_200_000;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// deploy: 2026-10-29 omni-flash-v8 (Veo 3.1 preview desligado em 22/10)

interface ReqBody {
  tool: "veo_text_to_video_direct" | "veo_status" | "hf_text_to_video_direct" | "hf_text_to_video" | "hf_status";
  args: Record<string, unknown>;
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

async function reserveQuota(orgId: string, userId: string): Promise<QuotaResult> {
  const { data, error } = await admin().schema("app_social").rpc("reserve_ai_quota", {
    _org_id: orgId,
    _user_id: userId,
    _feature: VEO_FEATURE,
    _units: 1,
  });
  if (error) throw error;
  return data as QuotaResult;
}

async function releaseQuota(orgId: string): Promise<void> {
  const { error } = await admin().schema("app_social").rpc("release_ai_quota", {
    _org_id: orgId,
    _feature: VEO_FEATURE,
    _units: 1,
  });
  if (error) console.error("[veo-generate] quota release failed:", error.message);
}

async function recordGeneration(params: {
  orgId: string;
  userId: string;
  model: string;
  costMicrousd: number;
  status: "ok" | "erro" | "negado";
  errorMessage?: string;
}): Promise<void> {
  const { error } = await admin().schema("app_social").rpc("record_ai_generation", {
    _org_id: params.orgId,
    _user_id: params.userId,
    _feature: VEO_FEATURE,
    _provider: "veo",
    _model: params.model,
    _units: 1,
    _custo_estimado_microusd: params.costMicrousd,
    _status: params.status,
    _error_message: params.errorMessage ?? null,
  });
  if (error) console.error("[veo-generate] usage record failed:", error.message);
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
    return `Cota de vídeos da sua organização esgotada — ${quota.usado_mes}/${quota.limite_mes} este mês. Volta em ${formatReset(quota.reset_mes)}.`;
  }
  return `Cota de vídeos da sua organização esgotada — ${quota.usado_dia}/${quota.limite_dia} hoje. Volta em ${formatReset(quota.reset_dia)}.`;
}

async function startVideo(userId: string, key: string, args: Record<string, unknown>): Promise<Response> {
  const prompt = String(args.prompt || "").trim();
  if (!prompt) return json({ error: "prompt obrigatório." }, 400);
  const durationSeconds = Number(args.duration || 8);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return json({ error: "duration inválida." }, 400);
  }

  let orgId: string | null = null;
  let reserved = false;
  try {
    orgId = await resolveOrgId(userId);
    if (!orgId) return json({ error: "Sua conta não está vinculada a nenhuma organização." }, 403);

    const quota = await reserveQuota(orgId, userId);
    if (!quota.allowed) {
      const message = quotaMessage(quota);
      await recordGeneration({
        orgId, userId, model: OMNI_MODEL, costMicrousd: 0, status: "negado", errorMessage: message,
      });
      return json({
        error: message,
        code: "quota_exceeded",
        motivo: quota.motivo,
        usado_dia: quota.usado_dia,
        limite_dia: quota.limite_dia,
        usado_mes: quota.usado_mes,
        limite_mes: quota.limite_mes,
        reset_dia: quota.reset_dia,
        reset_mes: quota.reset_mes,
      }, 429);
    }
    reserved = true;

    const res = await fetch(`${GEMINI_BASE}/interactions`, {
      method: "POST",
      headers: geminiHeaders(key),
      body: JSON.stringify(omniRequest(prompt, args)),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[veo-generate] start error", res.status, data);
      const message = data?.error?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }
    if (!data.id) throw new Error("Gemini não retornou o id da geração.");

    await recordGeneration({
      orgId,
      userId,
      model: OMNI_MODEL,
      costMicrousd: Math.round(VEO_8S_COST_MICROUSD * durationSeconds / 8),
      status: "ok",
    });
    reserved = false;
    return json({ status: "queued", request_id: `interactions/${data.id}`, status_url: "", cancel_url: "" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    const errorCode = typeof e === "object" && e && "code" in e ? String(e.code) : "";
    if (errorCode === "42501" && !reserved) {
      return json({ error: "Sua organização não possui acesso ativo ao Social." }, 403);
    }
    if (orgId && reserved) {
      await releaseQuota(orgId);
      await recordGeneration({
        orgId, userId, model: OMNI_MODEL, costMicrousd: 0, status: "erro", errorMessage: message,
      });
    }
    console.error("[veo-generate] start failed:", message);
    return json({ error: message }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const user = await getUser(req);
  if (!user) return json({ error: "Não autorizado" }, 401);
  if (req.method === "GET" && new URL(req.url).searchParams.get("tool") === "veo_file") {
    return serveVeoFile(req);
  }

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const { tool, args } = (await req.json()) as ReqBody;

    if (tool === "veo_text_to_video_direct" || tool === "hf_text_to_video_direct" || tool === "hf_text_to_video") {
      return startVideo(user.id, key, args);
    }

    if (tool === "veo_status" || tool === "hf_status") {
      const opName = String(args.request_id || "").trim();
      if (!opName) throw new Error("request_id obrigatório.");
      if (!opName.startsWith("interactions/")) {
        return json({
          status: "failed",
          request_id: opName,
          error: "Esta geração usava o Veo 3.1, que o Google desligou. Gere o vídeo de novo.",
        });
      }

      const res = await fetch(`${GEMINI_BASE}/${opName}`, { headers: geminiHeaders(key) });
      const data = await res.json();
      if (!res.ok) {
        console.error("[veo-generate] status error", res.status, data);
        return json({ error: data?.error?.message || `HTTP ${res.status}` }, 502);
      }
      if (data.status === "in_progress") return json({ status: "in_progress", request_id: opName });
      if (data.status !== "completed") {
        const detail = Array.isArray(data.errors) ? data.errors[0]?.message : undefined;
        console.error("[veo-generate] interaction", data.status, JSON.stringify(data.errors ?? null).slice(0, 800));
        return json({ status: "failed", request_id: opName, error: detail || `Geração terminou como ${data.status}.` });
      }

      const video = findVideo(data.steps);
      if (!video?.data && !video?.uri) {
        console.error("[veo-generate] no video in steps", JSON.stringify(data.steps ?? null).slice(0, 800));
        return json({ status: "failed", request_id: opName, error: "O Gemini não retornou vídeo." });
      }

      const permanent = video.data
        ? await persistBytes(base64ToBytes(video.data), opName)
        : await persistVideo(String(video.uri), opName, key);
      if (permanent) {
        return json({ status: "completed", request_id: opName, video: { url: permanent } });
      }
      if (!video.uri) {
        return json({ status: "failed", request_id: opName, error: "Não foi possível salvar o vídeo." });
      }
      // Fallback (upload falhou): serve via esta funcao. req.url dentro do edge
      // runtime e interna (sem /functions/v1 e com http); monta a URL publica
      // a partir do SUPABASE_URL injetado pelo runtime.
      const reqUrl = new URL(req.url);
      let fnPath = reqUrl.pathname;
      if (!fnPath.startsWith("/functions/v1")) fnPath = `/functions/v1${fnPath}`;
      const base = (Deno.env.get("SUPABASE_URL") || reqUrl.origin).replace(/\/+$/, "");
      const downloadUrl = new URL(`${base}${fnPath}`);
      downloadUrl.searchParams.set("tool", "veo_file");
      downloadUrl.searchParams.set("uri", String(video.uri));
      return json({ status: "completed", request_id: opName, video: { url: downloadUrl.toString() } });
    }

    return json({ error: `tool desconhecida: ${tool}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("veo-generate error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function geminiHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-goog-api-key": key };
}

/**
 * Corpo da Interactions API. O Omni não tem campo de duração (3 a 10 s, guiado pelo
 * prompt) nem negative prompt, então os dois viram instrução no texto.
 */
function omniRequest(prompt: string, args: Record<string, unknown>) {
  const duration = Math.min(10, Math.max(3, Math.round(Number(args.duration) || 8)));
  let text = `${prompt}\n\nDuração do vídeo: ${duration} segundos.`;
  if (args.negative_prompt) text += `\nEvite: ${String(args.negative_prompt)}.`;
  return {
    model: OMNI_MODEL,
    input: text,
    response_format: {
      type: "video",
      aspect_ratio: mapAspect(String(args.aspect_ratio || "16:9")),
      resolution: mapResolution(String(args.resolution || "1080p")),
    },
    background: true,
  };
}

interface VideoContent {
  type?: string;
  data?: string;
  uri?: string;
}

function findVideo(steps: unknown): VideoContent | null {
  if (!Array.isArray(steps)) return null;
  for (const step of steps) {
    const content = (step as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    const video = content.find((c: VideoContent) => c?.type === "video");
    if (video) return video as VideoContent;
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Baixa o video do Gemini e sobe pro bucket publico "media".
 */
async function persistVideo(uri: string, opName: string, key: string): Promise<string | null> {
  try {
    const vid = await fetch(uri, { headers: { "x-goog-api-key": key } });
    if (!vid.ok) {
      console.error("[veo-generate] persist: download falhou", vid.status);
      return null;
    }
    return await persistBytes(new Uint8Array(await vid.arrayBuffer()), opName);
  } catch (e) {
    console.error("[veo-generate] persist error:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Sobe o mp4 pro bucket publico "media" (service role bypassa a RLS do bucket).
 * Idempotente: o path deriva do nome da operacao.
 */
async function persistBytes(bytes: Uint8Array, opName: string): Promise<string | null> {
  try {
    const supaUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !serviceKey) return null;

    const safe = opName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-80);
    const path = `veo/${safe}.mp4`;
    const publicUrl = `${supaUrl}/storage/v1/object/public/media/${path}`;

    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return publicUrl;

    const up = await fetch(`${supaUrl}/storage/v1/object/media/${path}`, {
      method: "POST",
      headers: {
        // Projetos com API keys novas injetam sb_secret_... aqui; o Storage
        // aceita essa key no header apikey (Bearer exige JWT e falharia).
        apikey: serviceKey,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) {
      console.error("[veo-generate] persist: upload falhou", up.status, await up.text());
      return null;
    }
    return publicUrl;
  } catch (e) {
    console.error("[veo-generate] persist error:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function serveVeoFile(req: Request): Promise<Response> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "GEMINI_API_KEY não configurada." }, 500);

  const uri = new URL(req.url).searchParams.get("uri") || "";
  let videoUrl: URL;
  try {
    videoUrl = new URL(uri);
  } catch {
    return json({ error: "URI de vídeo inválida." }, 400);
  }

  const allowedHosts = new Set(["generativelanguage.googleapis.com", "storage.googleapis.com"]);
  if (videoUrl.protocol !== "https:" || !allowedHosts.has(videoUrl.hostname)) {
    return json({ error: "URI de vídeo inválida." }, 400);
  }

  const res = await fetch(videoUrl.toString(), { headers: { "x-goog-api-key": key } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return json({ error: data?.error?.message || `HTTP ${res.status}` }, res.status);
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": res.headers.get("Content-Type") || "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function mapAspect(a: string): string {
  // Omni aceita "16:9" e "9:16"; 1:1/4:5 → 9:16 mais próximo do vertical, 16:9 senão.
  if (a === "9:16" || a === "16:9") return a;
  if (a === "4:5" || a === "3:4" || a === "1:1") return "9:16";
  return "16:9";
}
function mapResolution(r: string): string {
  if (r === "720p" || r === "1080p") return r;
  return "1080p";
}
