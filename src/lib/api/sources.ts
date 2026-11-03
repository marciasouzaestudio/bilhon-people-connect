/**
 * Source extraction — extração de fontes via Firecrawl + IA.
 * Síncrono (sem polling): retorna conteúdo extraído e sumarizado.
 */

import { getSupabaseUrl, getSavedConfig, baseHeaders } from "./_shared";
import type { ContentSource } from "@/types";

export interface ExtractSourceParams {
  sourceType: string;
  url?: string;
  text?: string;
  customInstructions?: string;
}

export async function extractSource(params: ExtractSourceParams): Promise<ContentSource> {
  const url = `${getSupabaseUrl()}/functions/v1/social_source-extract`;
  const cfg = getSavedConfig();
  const headers = baseHeaders();
  if (cfg.firecrawlApiKey) headers["x-firecrawl-api-key"] = cfg.firecrawlApiKey;

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
