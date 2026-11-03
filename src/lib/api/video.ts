/**
 * Dispatcher único de geração de vídeo.
 * Regra da plataforma: todo vídeo do Studio é Veo 3.1 via Gemini.
 * Nenhuma geração/status de vídeo deve depender de credenciais Higgsfield.
 */

import { veoTextToVideo, veoStatus, VEO_GEMINI_MODEL_ID, type VideoGenerationResult, type VideoStatusResult } from "./veo";

export async function startTextToVideo(args: Record<string, unknown>): Promise<VideoGenerationResult> {
  const { prompt = "", ...rest } = args as { prompt?: string } & Record<string, unknown>;
  const r = await veoTextToVideo(String(prompt), {
    ...rest,
    model: VEO_GEMINI_MODEL_ID,
  } as Parameters<typeof veoTextToVideo>[1]);
  return { ...r, request_id: r.request_id.startsWith("veo:") ? r.request_id : `veo:${r.request_id}` };
}

export async function videoGenStatus(requestId: string): Promise<VideoStatusResult> {
  const real = requestId.startsWith("veo:") ? requestId.slice(4) : requestId;
  return veoStatus(real);
}
