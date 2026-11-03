/**
 * Vídeo do Studio via Gemini Omni Flash (Interactions API) — text-to-video.
 *
 * O Veo 3.1 preview (`veo-3.1-generate-preview`, `:predictLongRunning`) foi desligado
 * pelo Google em 22/10/2026 e passou a responder 404. O substituto indicado é o
 * `gemini-omni-1.1-flash`, que só existe na Interactions API.
 *
 * Tools (os nomes "veo_*" ficaram por compatibilidade com o front e o autopilot):
 *   - veo_text_to_video_direct → cria a interação em background e retorna
 *                                { request_id: "interactions/<id>", status: "queued" }
 *   - veo_status               → devolve { status, video?: { url } }
 *
 * O mp4 pronto é salvo no bucket público "media" para não expor a GEMINI_API_KEY
 * no navegador e porque os arquivos do Gemini expiram.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OMNI_MODEL = "gemini-omni-1.1-flash";
// deploy: 2026-10-29 omni-flash-v8 (Veo 3.1 preview desligado em 22/10)

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

      const res = await fetch(`${GEMINI_BASE}/interactions`, {
        method: "POST",
        headers: geminiHeaders(key),
        body: JSON.stringify(omniRequest(prompt, args)),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[veo-generate] start error", res.status, data);
        // 502 e nunca o status do Google: um 404 do modelo fazia o front pular para a
        // rota seguinte, e o usuário via "Não autorizado" no lugar do erro real.
        return json({ error: data?.error?.message || `HTTP ${res.status}` }, 502);
      }
      if (!data.id) throw new Error("Gemini não retornou o id da geração.");
      return json({ status: "queued", request_id: `interactions/${data.id}`, status_url: "", cancel_url: "" });
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
