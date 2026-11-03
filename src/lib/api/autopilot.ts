/**
 * Autopilot orchestration via the autopilot-run Edge Function.
 */

import { getSupabaseUrl, authHeaders } from "./_shared";

/** Ações da esteira: texto → visual → curadoria → aprovação → agendamento. */
export type AutopilotAction =
  | "generate"
  | "generate_visuals"
  | "curate"
  | "schedule"
  | "check_visuals"
  | "confirm";

export async function runAutopilot(
  action: AutopilotAction,
  params: { config_id?: string; calendar_id?: string; post_id?: string; retry_failed?: boolean }
): Promise<Record<string, unknown>> {
  const url = `${getSupabaseUrl()}/functions/v1/social_autopilot-run`;
  // JWT da SESSÃO (não a anon key): social_autopilot-run herda verify_jwt=true.
  // A edge→edge para social_openai-image usa SERVICE ROLE no servidor.
  const headers = await authHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    let errorMsg: string;
    try { const e = await response.json(); errorMsg = e.error || `HTTP ${response.status}`; }
    catch { errorMsg = `HTTP ${response.status}`; }
    throw new Error(errorMsg);
  }

  return response.json();
}
