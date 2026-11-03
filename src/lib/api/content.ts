/**
 * AI content generation + stock image search.
 *
 * Call Supabase Edge Functions (generate-content / stock-search),
 * which use the Lovable AI Gateway and the user's saved provider keys.
 */

import { getSupabaseUrl, getSavedConfig, baseHeaders } from "./_shared";

// ─── AI Content Generation ──────────────────────────────────────

export interface BrandProfileForAI {
  name: string;
  description?: string;
  tone: string;
  targetAudience?: string;
  industry?: string;
  keywords?: string[];
  avoidWords?: string[];
  examplePosts?: string[];
  systemPrompt?: string;
}

export interface GenerateContentParams {
  prompt: string;
  platforms: string[];
  tone?: string;
  language?: string;
  sourceContent?: string;
  brandProfile?: BrandProfileForAI;
}

export interface CarouselSlide {
  heading: string;
  body: string;
}

export interface GenerateContentResult {
  posts: Record<string, string>;
  carousel?: {
    title: string;
    slides: CarouselSlide[];
  };
  imageKeywords?: string[];
  visualSuggestion?: string;
  hashtags?: string[];
}

// ─── Stock Image Search (Pexels) ─────────────────────────────────

export interface StockImage {
  id: string;
  url: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  author: string;
  authorUrl: string;
  source: string;
}

export interface StockSearchParams {
  query: string;
  count?: number;
  orientation?: "landscape" | "portrait" | "squarish";
}

/** Busca fotos de acervo (Pexels) via edge function stock-search. */
export async function searchStockImages(
  params: StockSearchParams
): Promise<{ images: StockImage[] }> {
  const url = `${getSupabaseUrl()}/functions/v1/social_stock-search`;
  const cfg = getSavedConfig();
  const headers = baseHeaders();
  if (cfg.pexelsApiKey) headers["x-pexels-api-key"] = cfg.pexelsApiKey;

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

/** Valida uma chave Pexels via stock-search (sem expor a chave no cliente). */
export async function validatePexelsKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `${getSupabaseUrl()}/functions/v1/social_stock-search`;
    const headers = baseHeaders();
    headers["x-pexels-api-key"] = key;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "teste", count: 1 }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { valid: false, error: body.error || `HTTP ${res.status}` };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const url = `${getSupabaseUrl()}/functions/v1/social_generate-content`;
  const headers = baseHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg: string;
    try {
      const errBody = await response.json();
      errorMsg = errBody.error || `HTTP ${response.status}`;
    } catch {
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
