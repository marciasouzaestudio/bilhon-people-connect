/**
 * OpenAI image generation via the openai-image Edge Function.
 * A chave OpenAI é resolvida no servidor (Supabase Vault) — o cliente nunca a vê.
 */

import { getSupabaseUrl, authHeaders } from "./_shared";

export interface OpenAiImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  n?: number;
  model?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
}

export interface OpenAiImageResult {
  images: string[]; // data URLs (base64) ou URLs
  model: string;
}

export async function generateOpenAiImage(params: OpenAiImageParams): Promise<OpenAiImageResult> {
  const url = `${getSupabaseUrl()}/functions/v1/social_openai-image`;
  const headers = await authHeaders();

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
