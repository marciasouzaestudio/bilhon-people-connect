/**
 * Firecrawl web search via the firecrawl-search Edge Function.
 */

import { getSupabaseUrl, baseHeaders } from "./_shared";

export async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 5
): Promise<{ success?: boolean; results: { url: string; title: string; markdown: string }[] }> {
  const url = `${getSupabaseUrl()}/functions/v1/social_firecrawl-search`;
  const headers = baseHeaders();
  headers["x-firecrawl-api-key"] = apiKey;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    let errorMsg: string;
    try { const e = await response.json(); errorMsg = e.error || `HTTP ${response.status}`; }
    catch { errorMsg = `HTTP ${response.status}`; }
    throw new Error(errorMsg);
  }

  return response.json();
}

/** Validate Firecrawl API key */
export async function validateFirecrawlKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const result = await firecrawlSearch(apiKey, "test", 1);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}
