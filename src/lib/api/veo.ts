/**
 * Cliente de vídeo do Gemini (Omni Flash; o nome "veo" ficou do Veo 3.1, desligado em 22/10/2026).
 * Usa somente a GEMINI_API_KEY do backend; BYOK e credenciais legadas são ignoradas.
 */

import { getSupabaseUrl, authHeaders } from "./_shared";

export const VEO_GEMINI_MODEL_ID = "google/veo-3.1";

export interface VideoGenerationResult {
  request_id: string;
  status: string;
  [k: string]: unknown;
}

export interface VideoStatusResult {
  status: "queued" | "in_progress" | "processing" | "completed" | "failed" | "nsfw" | string;
  request_id?: string;
  video?: { url?: string };
  error?: string;
  [k: string]: unknown;
}

export function isVeoGeminiModel(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.startsWith("google/veo") || id.startsWith("veo-3.1");
}

async function callVeo(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const routes = ["social_higgsfield-proxy", "veo-generate", "social_veo-generate"];
  let lastError = "Erro ao chamar Veo";

  for (const route of routes) {
    let res: Response;
    try {
      res = await fetch(`${getSupabaseUrl()}/functions/v1/${route}`, {
        method: "POST",
        // social_veo-generate exige o JWT da sessão; com a anon key ela devolvia
        // "Não autorizado" sempre que a rota anterior falhava.
        headers: await authHeaders(),
        body: JSON.stringify({ tool, args }),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Failed to fetch";
      continue;
    }

    if (res.ok) return res.json();

    let msg = `HTTP ${res.status}`;
    // O gateway responde { message: "Requested function was not found" }; a function, { error }.
    try { const e = await res.json(); msg = e.error || e.message || msg; } catch { /* keep */ }
    lastError = msg;

    // Só pula de rota quando a function não existe. Um 404 vindo do Google (modelo
    // desligado) é erro real e precisa chegar ao usuário.
    const canTryNext =
      msg.includes("Requested function was not found") ||
      msg.includes("Higgsfield API credentials");
    if (!canTryNext) break;
  }

  throw new Error(lastError);
}

export async function veoTextToVideo(prompt: string, opts?: {
  model?: string; aspect_ratio?: string; resolution?: string;
  duration?: number; with_audio?: boolean; negative_prompt?: string;
}): Promise<VideoGenerationResult> {
  return callVeo("veo_text_to_video_direct", { prompt, ...opts, model: VEO_GEMINI_MODEL_ID }) as Promise<VideoGenerationResult>;
}

export async function veoStatus(requestId: string): Promise<VideoStatusResult> {
  return callVeo("veo_status", { request_id: requestId }) as Promise<VideoStatusResult>;
}
