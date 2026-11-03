import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Veo 3.1 (Google Gemini API) — text-to-video.
 *
 * Tools:
 *   - veo_text_to_video_direct → inicia a operação e retorna { request_id, status: "queued" }
 *   - veo_status               → devolve { status, video?: { url } }
 *
 * O request_id devolvido é o próprio `operations/...` do Gemini; a URL final
 * é servida por esta função para não expor a GEMINI_API_KEY no navegador.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "veo-3.1-generate-preview";
// deploy: 2026-07-17 veo-direct-studio-v7 (persiste mp4 no Storage)

interface ReqBody {
  tool: "veo_text_to_video_direct" | "veo_status" | "hf_text_to_video_direct" | "hf_text_to_video" | "hf_status";
  args: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === "GET" && new URL(req.url).searchParams.get("tool") === "veo_file") {
    return serveVeoFile(req);
  }

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const { tool, args } = (await req.json()) as ReqBody;

    if (tool === "veo_text_to_video_direct" || tool === "hf_text_to_video_direct" || tool === "hf_text_to_video") {
      const prompt = String(args.prompt || "").trim();
      if (!prompt) throw new Error("prompt obrigatório.");
      const model = normalizeModel(args.model);
      const aspect = mapAspect(String(args.aspect_ratio || "16:9"));
      const resolution = mapResolution(String(args.resolution || "1080p"));
      const durationSeconds = Number(args.duration || 8);

      const body = {
        instances: [{ prompt }],
        parameters: {
          aspectRatio: aspect,
          resolution,
          durationSeconds,
          personGeneration: "allow_all",
          // generateAudio é rejeitado pelos previews atuais do Veo 3.1 (áudio já vem por padrão).
          ...(args.negative_prompt ? { negativePrompt: String(args.negative_prompt) } : {}),
        },
      };

      const url = `${GEMINI_BASE}/models/${model}:predictLongRunning`;
      const res = await fetch(url, {
        method: "POST",
        headers: geminiHeaders(key),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[veo-generate] start error", res.status, data);
        const msg = data?.error?.message || `HTTP ${res.status}`;
        return json({ error: msg }, res.status);
      }
      const opName: string = data.name;
      return json({ status: "queued", request_id: opName, status_url: "", cancel_url: "" });
    }

    if (tool === "veo_status" || tool === "hf_status") {
      const opName = String(args.request_id || "").trim();
      if (!opName) throw new Error("request_id obrigatório.");
      const url = `${GEMINI_BASE}/${opName}`;
      const res = await fetch(url, { headers: geminiHeaders(key) });
      const data = await res.json();
      if (!res.ok) {
        console.error("[veo-generate] status error", res.status, data);
        return json({ error: data?.error?.message || `HTTP ${res.status}` }, res.status);
      }
      if (!data.done) return json({ status: "in_progress", request_id: opName });

      if (data.error) {
        return json({ status: "failed", request_id: opName, error: data.error.message || "Falha no Veo." });
      }

      // Diferentes campos de resposta conforme versão do preview.
      const resp = data.response || {};
      const samples =
        resp.generateVideoResponse?.generatedSamples ||
        resp.generatedVideos ||
        resp.generatedSamples || [];
      const first = Array.isArray(samples) ? samples[0] : null;
      const uri: string | undefined =
        first?.video?.uri || first?.video?.videoUri || first?.uri;
      if (!uri) {
        console.error("[veo-generate] no uri in response", JSON.stringify(resp).slice(0, 800));
        return json({ status: "failed", request_id: opName, error: "Veo não retornou vídeo." });
      }
      // As URLs de arquivo do Gemini expiram em ~48h — persiste o mp4 no bucket
      // publico "media" e devolve uma URL permanente terminada em .mp4.
      const permanent = await persistVideo(String(uri), opName, key);
      if (permanent) {
        return json({ status: "completed", request_id: opName, video: { url: permanent } });
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
      downloadUrl.searchParams.set("uri", String(uri));
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

function normalizeModel(model: unknown): string {
  const id = String(model || DEFAULT_MODEL).replace(/^google\//, "");
  if (id === "veo-3.1" || id === "veo3.1" || id === "veo3.1/text-to-video") return DEFAULT_MODEL;
  if (id === "veo-3.1-fast" || id === "veo3.1-fast") return "veo-3.1-fast-generate-preview";
  if (id.endsWith("/text-to-video")) return DEFAULT_MODEL;
  return id;
}

/**
 * Baixa o video do Gemini e sobe pro bucket publico "media" (service role
 * bypassa a RLS do bucket). Idempotente: o path deriva do nome da operacao.
 */
async function persistVideo(uri: string, opName: string, key: string): Promise<string | null> {
  try {
    const supaUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !serviceKey) return null;

    const safe = opName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-80);
    const path = `veo/${safe}.mp4`;
    const publicUrl = `${supaUrl}/storage/v1/object/public/media/${path}`;

    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return publicUrl;

    const vid = await fetch(uri, { headers: { "x-goog-api-key": key } });
    if (!vid.ok) {
      console.error("[veo-generate] persist: download falhou", vid.status);
      return null;
    }
    const bytes = await vid.arrayBuffer();

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
  // Veo aceita "16:9" e "9:16"; 1:1/4:5 → 9:16 mais próximo do vertical, 16:9 senão.
  if (a === "9:16" || a === "16:9") return a;
  if (a === "4:5" || a === "3:4" || a === "1:1") return "9:16";
  return "16:9";
}
function mapResolution(r: string): string {
  if (r === "720p" || r === "1080p") return r;
  return "1080p";
}
