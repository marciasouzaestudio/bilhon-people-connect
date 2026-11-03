/**
 * Módulo CRIATIVOS (Meta Ads) — modelo de dados + helpers puros.
 *
 * A oferta/produto é o "offer canvas": a abstração que a IA consome junto com a
 * marca-raiz (brand_profiles) para produzir ângulos, copy e artes. Aqui ficam:
 *  - os tipos das 3 tabelas (creative_offers / creative_sets / creatives)
 *  - conversões linha ↔ modelo ↔ formato da IA
 *  - a composição do PROMPT DE IMAGEM (marca + oferta + brief do ângulo + formato)
 *  - CRUD via Supabase (schema app_social, RLS por org)
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireOrgId } from "@/lib/org";
import { brandTextProfile, type BrandProfile } from "@/lib/brand";
import type { CreativeAngle, CreativeBrandForAI, OfferForAI } from "@/lib/api/creatives";
import { formatSpec, normalizeCta, styleDirective, type CreativeFormat } from "@/lib/meta-creative-specs";

// ─── Tipos ──────────────────────────────────────────────────────

export interface CreativeOffer {
  id: string;
  brandId: string | null;
  name: string;
  productType: string;
  description: string;
  promise: string;
  targetAudience: string;
  painPoints: string[];
  benefits: string[];
  differentiators: string[];
  objections: string[];
  socialProof: string[];
  price: string;
  offerMechanism: string[];
  offerDetails: string;
  deadline: string;
  guarantee: string;
  ctaType: string;
  destinationUrl: string;
  productImages: string[];
  sourceUrl: string;
  notes: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OfferInput = Omit<CreativeOffer, "id" | "createdAt" | "updatedAt" | "isArchived">;

export interface CreativeSetOptions {
  textOnArt: boolean;
  useProductPhotos: boolean;
  includeLogo: boolean;
  style: string;
  extraDirection: string;
}

export type CreativeSetStatus = "planning" | "generating" | "done" | "failed";

export interface CreativeSet {
  id: string;
  offerId: string;
  brandId: string | null;
  name: string;
  objective: string;
  formats: CreativeFormat[];
  angleCount: number;
  options: CreativeSetOptions;
  plan: { strategy_note?: string; angles?: CreativeAngle[] };
  status: CreativeSetStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreativeStatus = "draft" | "approved" | "rejected";

export interface Creative {
  id: string;
  setId: string;
  offerId: string;
  brandId: string | null;
  angleId: string;
  angleName: string;
  hookType: string;
  format: CreativeFormat;
  headline: string;
  primaryText: string;
  description: string;
  ctaType: string;
  textOverlay: string;
  imageUrl: string | null;
  imagePrompt: string;
  status: CreativeStatus;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const DEFAULT_SET_OPTIONS: CreativeSetOptions = {
  textOnArt: true,
  useProductPhotos: true,
  includeLogo: true,
  style: "auto",
  extraDirection: "",
};

export const EMPTY_OFFER: OfferInput = {
  brandId: null,
  name: "",
  productType: "produto",
  description: "",
  promise: "",
  targetAudience: "",
  painPoints: [],
  benefits: [],
  differentiators: [],
  objections: [],
  socialProof: [],
  price: "",
  offerMechanism: [],
  offerDetails: "",
  deadline: "",
  guarantee: "",
  ctaType: "LEARN_MORE",
  destinationUrl: "",
  productImages: [],
  sourceUrl: "",
  notes: "",
};

// ─── Conversões ─────────────────────────────────────────────────

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const str = (v: unknown): string => (v == null ? "" : String(v));

export function offerFromRow(row: Record<string, unknown>): CreativeOffer {
  return {
    id: str(row.id),
    brandId: (row.brand_id as string) || null,
    name: str(row.name),
    productType: str(row.product_type) || "produto",
    description: str(row.description),
    promise: str(row.promise),
    targetAudience: str(row.target_audience),
    painPoints: arr(row.pain_points),
    benefits: arr(row.benefits),
    differentiators: arr(row.differentiators),
    objections: arr(row.objections),
    socialProof: arr(row.social_proof),
    price: str(row.price),
    offerMechanism: arr(row.offer_mechanism),
    offerDetails: str(row.offer_details),
    deadline: str(row.deadline),
    guarantee: str(row.guarantee),
    ctaType: normalizeCta(str(row.cta_type)),
    destinationUrl: str(row.destination_url),
    productImages: arr(row.product_images),
    sourceUrl: str(row.source_url),
    notes: str(row.notes),
    isArchived: Boolean(row.is_archived),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function offerToRow(o: OfferInput): Record<string, unknown> {
  return {
    brand_id: o.brandId || null,
    name: o.name.trim(),
    product_type: o.productType || "produto",
    description: o.description || null,
    promise: o.promise || null,
    target_audience: o.targetAudience || null,
    pain_points: o.painPoints,
    benefits: o.benefits,
    differentiators: o.differentiators,
    objections: o.objections,
    social_proof: o.socialProof,
    price: o.price || null,
    offer_mechanism: o.offerMechanism,
    offer_details: o.offerDetails || null,
    deadline: o.deadline || null,
    guarantee: o.guarantee || null,
    cta_type: normalizeCta(o.ctaType),
    destination_url: o.destinationUrl || null,
    product_images: o.productImages,
    source_url: o.sourceUrl || null,
    notes: o.notes || null,
  };
}

/** Oferta → formato camelCase que a edge function consome. Omite campos vazios. */
export function offerToAI(o: OfferInput | CreativeOffer): OfferForAI {
  const out: OfferForAI = { name: o.name };
  if (o.productType) out.productType = o.productType;
  if (o.description) out.description = o.description;
  if (o.promise) out.promise = o.promise;
  if (o.targetAudience) out.targetAudience = o.targetAudience;
  if (o.painPoints.length) out.painPoints = o.painPoints;
  if (o.benefits.length) out.benefits = o.benefits;
  if (o.differentiators.length) out.differentiators = o.differentiators;
  if (o.objections.length) out.objections = o.objections;
  if (o.socialProof.length) out.socialProof = o.socialProof;
  if (o.price) out.price = o.price;
  if (o.offerMechanism.length) out.offerMechanism = o.offerMechanism;
  if (o.offerDetails) out.offerDetails = o.offerDetails;
  if (o.deadline) out.deadline = o.deadline;
  if (o.guarantee) out.guarantee = o.guarantee;
  if (o.ctaType) out.ctaType = o.ctaType;
  if (o.destinationUrl) out.destinationUrl = o.destinationUrl;
  if (o.notes) out.notes = o.notes;
  return out;
}

/** Resposta da IA (offer_from_context) → campos do formulário, preservando o que o usuário já digitou quando a IA veio vazia. */
export function mergeOfferFromAI(base: OfferInput, ai: Partial<OfferForAI>): OfferInput {
  const pick = (cur: string, v: unknown) => (str(v).trim() ? str(v).trim() : cur);
  const pickArr = (cur: string[], v: unknown) => (arr(v).length ? arr(v) : cur);
  return {
    ...base,
    name: pick(base.name, ai.name),
    productType: pick(base.productType, ai.productType),
    description: pick(base.description, ai.description),
    promise: pick(base.promise, ai.promise),
    targetAudience: pick(base.targetAudience, ai.targetAudience),
    painPoints: pickArr(base.painPoints, ai.painPoints),
    benefits: pickArr(base.benefits, ai.benefits),
    differentiators: pickArr(base.differentiators, ai.differentiators),
    objections: pickArr(base.objections, ai.objections),
    socialProof: pickArr(base.socialProof, ai.socialProof),
    price: pick(base.price, ai.price),
    offerMechanism: pickArr(base.offerMechanism, ai.offerMechanism),
    offerDetails: pick(base.offerDetails, ai.offerDetails),
    deadline: pick(base.deadline, ai.deadline),
    guarantee: pick(base.guarantee, ai.guarantee),
    ctaType: ai.ctaType ? normalizeCta(ai.ctaType) : base.ctaType,
    destinationUrl: pick(base.destinationUrl, ai.destinationUrl),
  };
}

/** Marca → perfil para a IA de criativos (texto + paleta + valores). */
export function brandForCreatives(b?: BrandProfile | null): CreativeBrandForAI | undefined {
  const base = brandTextProfile(b);
  if (!base || !b) return undefined;
  return { ...base, colors: b.colors?.length ? b.colors : undefined, values: b.values || undefined };
}

export function setFromRow(row: Record<string, unknown>): CreativeSet {
  const options = (row.options as Partial<CreativeSetOptions>) || {};
  return {
    id: str(row.id),
    offerId: str(row.offer_id),
    brandId: (row.brand_id as string) || null,
    name: str(row.name),
    objective: str(row.objective) || "conversao",
    formats: arr(row.formats) as CreativeFormat[],
    angleCount: Number(row.angle_count) || 4,
    options: { ...DEFAULT_SET_OPTIONS, ...options },
    plan: (row.plan as CreativeSet["plan"]) || {},
    status: (str(row.status) as CreativeSetStatus) || "planning",
    errorMessage: (row.error_message as string) || null,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function creativeFromRow(row: Record<string, unknown>): Creative {
  return {
    id: str(row.id),
    setId: str(row.set_id),
    offerId: str(row.offer_id),
    brandId: (row.brand_id as string) || null,
    angleId: str(row.angle_id),
    angleName: str(row.angle_name),
    hookType: str(row.hook_type),
    format: (str(row.format) as CreativeFormat) || "feed_1x1",
    headline: str(row.headline),
    primaryText: str(row.primary_text),
    description: str(row.description),
    ctaType: normalizeCta(str(row.cta_type)),
    textOverlay: str(row.text_overlay),
    imageUrl: (row.image_url as string) || null,
    imagePrompt: str(row.image_prompt),
    status: (str(row.status) as CreativeStatus) || "draft",
    sortOrder: Number(row.sort_order) || 0,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: str(row.created_at),
  };
}

// ─── Prompt de imagem ───────────────────────────────────────────

/**
 * Diretiva de marca para ARTE DE ANÚNCIO. Diferente da brandImageDirective do
 * Studio: aqui texto e logo são bem-vindos (quando pedidos), porque o criativo
 * precisa carregar a mensagem e a assinatura da marca.
 */
export function brandAdDirective(b?: BrandProfile | null): string {
  if (!b?.name) return "";
  const parts: string[] = [];
  if (b.colors?.length) parts.push(`paleta de cores da marca: ${b.colors.join(", ")} (use como base do fundo, dos elementos gráficos e dos detalhes)`);
  if (b.tone) parts.push(`mood alinhado ao tom "${b.tone}"`);
  if (b.industry) parts.push(`setor: ${b.industry}`);
  if (b.values) parts.push(`valores: ${b.values}`);
  return `Identidade visual da marca ${b.name}: ${parts.join("; ")}.`;
}

export interface ImagePromptInput {
  brand: BrandProfile | null;
  offer: CreativeOffer | OfferInput;
  angle: CreativeAngle;
  format: CreativeFormat;
  options: CreativeSetOptions;
  /** Quantas imagens de referência vão junto e o que cada uma é (produto/logo). */
  references: { productCount: number; hasLogo: boolean };
}

/**
 * Compõe o prompt final da arte: marca + produto + brief do ângulo + formato +
 * texto estampado + instruções sobre as referências (produto real / logo real).
 * Determinístico e puro — testável.
 */
export function buildImagePrompt(i: ImagePromptInput): string {
  const spec = formatSpec(i.format);
  const parts: string[] = [];

  parts.push(`Arte de anúncio para Meta Ads (Facebook/Instagram), placement ${spec.placement}, proporção final ${spec.ratioLabel}.`);
  const brandLine = brandAdDirective(i.brand);
  if (brandLine) parts.push(brandLine);

  parts.push(`Produto/oferta: ${i.offer.name}${i.offer.description ? ` — ${i.offer.description}` : ""}.`);

  // A marca do anúncio pode ser de quem anuncia (agência, loja, revenda) e não do
  // fabricante. Sem esta regra o modelo estampava o nome da marca na embalagem.
  if (i.brand?.name) {
    parts.push(`Regra de marca: "${i.brand.name}" é quem assina o anúncio, NÃO é o fabricante do produto. Nunca escreva "${i.brand.name}" nem aplique o logotipo sobre o produto, a embalagem ou o rótulo. A marca aparece somente como assinatura discreta num canto da arte.`);
  }

  const v = i.angle.visual || { scene: "", composition: "", text_overlay: "", style: "" };
  if (v.scene) parts.push(`Cena: ${v.scene}`);
  if (v.composition) parts.push(`Composição: ${v.composition}`);
  const style = styleDirective(i.options.style) || v.style;
  if (style) parts.push(`Estilo: ${style}`);

  const { productCount, hasLogo } = i.references;
  if (productCount > 0) {
    const n = productCount === 1 ? "A primeira imagem de referência é a foto real do produto" : `As ${productCount} primeiras imagens de referência são fotos reais do produto`;
    parts.push(`${n}: reproduza o produto FIELMENTE (forma, cores, rótulo, proporções) como protagonista da cena. Não invente outro produto.`);
  } else {
    parts.push(`Sem foto do produto: se a cena mostrar embalagem ou rótulo, ele traz apenas o nome "${i.offer.name}", sem inventar outra marca ou fabricante.`);
  }
  if (hasLogo) {
    parts.push(`A última imagem de referência é o logotipo oficial da marca: aplique-o discreto e legível em um canto da arte, fora do produto (sem distorcer, sem recolorir).`);
  }

  const overlay = i.options.textOnArt ? (i.angle.visual?.text_overlay || i.angle.headline || "").trim() : "";
  if (overlay) {
    parts.push(`Estampe na arte, com tipografia moderna e muito legível, EXATAMENTE este texto (em português, sem erros de grafia): "${overlay}". O texto ocupa no máximo 20% da área e não cobre o produto.`);
  } else {
    parts.push("Não renderize nenhum texto, palavra ou número na imagem.");
  }

  parts.push(`Conteúdo principal centralizado, com margens de segurança generosas: a imagem será recortada para ${spec.ratioLabel} (${spec.width}x${spec.height}). Alta qualidade, sem marca d'água, sem bordas, sem molduras, sem interface de rede social.`);

  if (i.options.extraDirection?.trim()) parts.push(`Direção extra do cliente: ${i.options.extraDirection.trim()}`);

  return parts.join("\n\n");
}

/** Monta a lista de referências (fotos do produto + logo) respeitando o teto de 4 da função. */
export function pickReferences(offer: CreativeOffer | OfferInput, brand: BrandProfile | null, options: CreativeSetOptions): { urls: string[]; productCount: number; hasLogo: boolean } {
  const isHttp = (u: string) => /^https?:\/\//i.test(u);
  const logo = options.includeLogo && brand?.logo_url && isHttp(brand.logo_url) ? brand.logo_url : "";
  const maxProducts = logo ? 3 : 4;
  const products = options.useProductPhotos ? offer.productImages.filter(isHttp).slice(0, maxProducts) : [];
  const urls = [...products, ...(logo ? [logo] : [])];
  return { urls, productCount: products.length, hasLogo: !!logo };
}

// ─── Exportação ─────────────────────────────────────────────────

/** Slug ASCII para nomes de arquivo: remove acentos ("Café" → "cafe") em vez de descartar a letra. */
export function slugify(text: string, fallback = "criativo"): string {
  const slug = (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/** Nome de arquivo estável para a arte de uma peça (ângulo + formato). */
export function creativeFilename(c: Pick<Creative, "angleName" | "format">): string {
  return `${slugify(c.angleName)}-${c.format}.png`;
}

/** Nome do CSV de um conjunto. */
export function setCsvFilename(setName: string): string {
  return `criativos-${slugify(setName, "conjunto")}.csv`;
}

/** CSV com as copies do conjunto (uma linha por criativo) para colar na planilha / Ads Manager. */
export function creativesToCsv(items: Creative[]): string {
  const esc = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["angulo", "gancho", "formato", "headline", "texto_principal", "descricao", "cta", "texto_na_arte", "imagem", "status"];
  const rows = items.map((c) => [
    c.angleName, c.hookType, formatSpec(c.format).ratioLabel, c.headline, c.primaryText, c.description, c.ctaType, c.textOverlay, c.imageUrl || "", c.status,
  ].map(esc).join(","));
  return [header.join(","), ...rows].join("\n");
}

// ─── CRUD ───────────────────────────────────────────────────────

export async function listOffers(): Promise<CreativeOffer[]> {
  const { data, error } = await supabase
    .from("creative_offers")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => offerFromRow(r as Record<string, unknown>));
}

export async function createOffer(input: OfferInput): Promise<CreativeOffer> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const org_id = await requireOrgId();
  const { data, error } = await supabase
    .from("creative_offers")
    .insert({ ...offerToRow(input), org_id, user_id: user.id } as unknown as Database["app_social"]["Tables"]["creative_offers"]["Insert"])
    .select()
    .single();
  if (error) throw error;
  return offerFromRow(data as Record<string, unknown>);
}

export async function updateOffer(id: string, input: OfferInput): Promise<CreativeOffer> {
  const { data, error } = await supabase
    .from("creative_offers")
    .update(offerToRow(input) as unknown as Database["app_social"]["Tables"]["creative_offers"]["Update"])
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return offerFromRow(data as Record<string, unknown>);
}

export async function archiveOffer(id: string): Promise<void> {
  const { error } = await supabase.from("creative_offers").update({ is_archived: true }).eq("id", id);
  if (error) throw error;
}

export async function listSets(): Promise<CreativeSet[]> {
  const { data, error } = await supabase
    .from("creative_sets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => setFromRow(r as Record<string, unknown>));
}

export async function createSet(input: {
  offerId: string;
  brandId: string | null;
  name: string;
  objective: string;
  formats: CreativeFormat[];
  angleCount: number;
  options: CreativeSetOptions;
  plan: CreativeSet["plan"];
}): Promise<CreativeSet> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const org_id = await requireOrgId();
  const { data, error } = await supabase
    .from("creative_sets")
    .insert({
      org_id,
      user_id: user.id,
      offer_id: input.offerId,
      brand_id: input.brandId,
      name: input.name,
      objective: input.objective,
      formats: input.formats,
      angle_count: input.angleCount,
      options: input.options as unknown as Json,
      plan: input.plan as unknown as Json,
      status: "generating",
    })
    .select()
    .single();
  if (error) throw error;
  return setFromRow(data as Record<string, unknown>);
}

export async function updateSetStatus(id: string, status: CreativeSetStatus, errorMessage?: string | null): Promise<void> {
  const { error } = await supabase
    .from("creative_sets")
    .update({ status, error_message: errorMessage ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from("creative_sets").delete().eq("id", id);
  if (error) throw error;
}

export async function listCreatives(setId: string): Promise<Creative[]> {
  const { data, error } = await supabase
    .from("creatives")
    .select("*")
    .eq("set_id", setId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => creativeFromRow(r as Record<string, unknown>));
}

export async function insertCreative(input: Omit<Creative, "id" | "createdAt">): Promise<Creative> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const org_id = await requireOrgId();
  const { data, error } = await supabase
    .from("creatives")
    .insert({
      org_id,
      user_id: user.id,
      set_id: input.setId,
      offer_id: input.offerId,
      brand_id: input.brandId,
      angle_id: input.angleId,
      angle_name: input.angleName,
      hook_type: input.hookType || null,
      format: input.format,
      headline: input.headline,
      primary_text: input.primaryText,
      description: input.description,
      cta_type: normalizeCta(input.ctaType),
      text_overlay: input.textOverlay || null,
      image_url: input.imageUrl,
      image_prompt: input.imagePrompt || null,
      status: input.status,
      sort_order: input.sortOrder,
      metadata: input.metadata as unknown as Json,
    })
    .select()
    .single();
  if (error) throw error;
  return creativeFromRow(data as Record<string, unknown>);
}

export async function updateCreative(id: string, patch: Partial<Pick<Creative, "headline" | "primaryText" | "description" | "ctaType" | "imageUrl" | "imagePrompt" | "status" | "metadata">>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.headline !== undefined) row.headline = patch.headline;
  if (patch.primaryText !== undefined) row.primary_text = patch.primaryText;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.ctaType !== undefined) row.cta_type = normalizeCta(patch.ctaType);
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.imagePrompt !== undefined) row.image_prompt = patch.imagePrompt;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.metadata !== undefined) row.metadata = patch.metadata;
  const { error } = await supabase.from("creatives").update(row).eq("id", id);
  if (error) throw error;
}

/** Sobe um Blob (arte recortada) para o bucket `media` e devolve a URL pública. */
export async function uploadCreativeBlob(blob: Blob, setId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  // A 1ª pasta precisa ser o auth.uid() (RLS do bucket media).
  const path = `${user.id}/criativos/${setId}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/png" });
  if (error) throw new Error(error.message || "Falha ao salvar a arte.");
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
