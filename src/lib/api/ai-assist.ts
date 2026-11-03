/**
 * AI Assist client — helper de IA genérico via edge function ai-assist.
 * Base para "IA em tudo" no Studio (melhorar prompt, sugerir direções, reescrever).
 */

import { getSupabaseUrl, baseHeaders } from "./_shared";

export interface AiAssistParams {
  prompt: string;
  system?: string;
  temperature?: number;
  expectJson?: boolean;
}

export interface AiAssistResult {
  text: string;
  json?: unknown;
}

export async function aiAssist(params: AiAssistParams): Promise<AiAssistResult> {
  const url = `${getSupabaseUrl()}/functions/v1/social_ai-assist`;
  const headers = baseHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let msg: string;
    try { const e = await response.json(); msg = e.error || `HTTP ${response.status}`; }
    catch { msg = `HTTP ${response.status}`; }
    throw new Error(msg);
  }

  return response.json();
}
