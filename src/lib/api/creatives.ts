/**
 * Cliente das edge functions do módulo Criativos (Meta Ads):
 *  - social_creative-generate → oferta estruturada a partir de contexto + plano de ângulos/copy.
 *  - social_creative-image    → arte (gpt-image) com fotos do produto/logo como referência.
 * Ambas exigem o JWT da sessão (verify_jwt=true).
 */

import { getSupabaseUrl, authHeaders } from "./_shared";
import type { BrandProfileForAI } from "./content";

export interface CreativeBrandForAI extends BrandProfileForAI {
  colors?: string[];
  values?: string;
}

/** Oferta no formato que a IA consome (camelCase). */
export interface OfferForAI {
  name: string;
  productType?: string;
  description?: string;
  promise?: string;
  targetAudience?: string;
  painPoints?: string[];
  benefits?: string[];
  differentiators?: string[];
  objections?: string[];
  socialProof?: string[];
  price?: string;
  offerMechanism?: string[];
  offerDetails?: string;
  deadline?: string;
  guarantee?: string;
  ctaType?: string;
  destinationUrl?: string;
  notes?: string;
}

export interface AngleVisualBrief {
  scene: string;
  composition: string;
  text_overlay: string;
  style: string;
}

export interface CreativeAngle {
  id: string;
  name: string;
  hook_type: string;
  rationale: string;
  headline: string;
  primary_text: string;
  description: string;
  cta_type: string;
  visual: AngleVisualBrief;
  alt_headlines?: string[];
}

export interface CreativePlanResult {
  strategy_note: string;
  angles: CreativeAngle[];
}

export interface CreativePlanParams {
  offer: OfferForAI;
  brandProfile?: CreativeBrandForAI;
  objective: string;
  angleCount: number;
  formats: string[];
  textOnArt: boolean;
  extraDirection?: string;
  excludeAngles?: string[];
}

async function call<T>(fn: string, body: unknown): Promise<T> {
  const url = `${getSupabaseUrl()}/functions/v1/${fn}`;
  const headers = await authHeaders();
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    let msg: string;
    try { const e = await response.json(); msg = e.error || `HTTP ${response.status}`; }
    catch { msg = `HTTP ${response.status}`; }
    throw new Error(msg);
  }
  return response.json();
}

/** Extrai a oferta estruturada de um texto livre (página de vendas, descrição do cliente). */
export async function creativeOfferFromContext(params: {
  context: string;
  brandProfile?: CreativeBrandForAI;
}): Promise<{ offer: Partial<OfferForAI> }> {
  return call("social_creative-generate", { mode: "offer_from_context", ...params });
}

/** Planeja N ângulos com copy pronta + brief visual. */
export async function creativePlan(params: CreativePlanParams): Promise<CreativePlanResult> {
  const res = await call<CreativePlanResult>("social_creative-generate", { mode: "plan", ...params });
  // Sanitiza a forma dos ângulos: a IA pode omitir campos.
  const angles = (res.angles || []).map((a, i) => ({
    id: String(a?.id || `a${i + 1}`),
    name: String(a?.name || `Ângulo ${i + 1}`),
    hook_type: String(a?.hook_type || ""),
    rationale: String(a?.rationale || ""),
    headline: String(a?.headline || ""),
    primary_text: String(a?.primary_text || ""),
    description: String(a?.description || ""),
    cta_type: String(a?.cta_type || ""),
    visual: {
      scene: String(a?.visual?.scene || ""),
      composition: String(a?.visual?.composition || ""),
      text_overlay: String(a?.visual?.text_overlay || ""),
      style: String(a?.visual?.style || ""),
    },
    alt_headlines: Array.isArray(a?.alt_headlines) ? a.alt_headlines.map(String) : [],
  }));
  return { strategy_note: res.strategy_note || "", angles };
}

export interface CreativeImageParams {
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
  /** URLs http das fotos do produto / logo. Com referências a função usa /images/edits. */
  referenceImages?: string[];
}

export interface CreativeImageResult {
  images: string[];
  model: string;
  mode: "edits" | "generations";
}

/** Gera a arte de um criativo. */
export async function generateCreativeImage(params: CreativeImageParams): Promise<CreativeImageResult> {
  return call("social_creative-image", params);
}
