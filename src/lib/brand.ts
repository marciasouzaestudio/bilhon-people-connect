/**
 * Marca como RAIZ de toda criação.
 *
 * Forma única do perfil de marca (espelha a tabela brand_profiles) + helpers
 * que transformam a marca em contexto para a IA — tanto para geração de TEXTO
 * (generate-content) quanto de IMAGEM (openai-image). Use sempre que gerar
 * qualquer conteúdo para que logo/nome/handle/paleta/tom/valores sejam a base.
 */

import type { BrandProfileForAI } from "@/lib/api";

export interface BrandProfile {
  id: string;
  name: string;
  description?: string;
  tone: string;
  target_audience?: string;
  industry?: string;
  keywords: string[];
  avoid_words: string[];
  example_posts: string[];
  system_prompt?: string;
  logo_url?: string;
  colors: string[];
  is_default: boolean;
  handle?: string;
  profile_photo_url?: string;
  website?: string;
  social_links?: Record<string, string>;
  values?: string;
}

/** Normaliza uma linha crua de brand_profiles para o tipo BrandProfile. */
export function normalizeBrand(row: Record<string, unknown>): BrandProfile {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: (row.description as string) ?? "",
    tone: (row.tone as string) ?? "",
    target_audience: (row.target_audience as string) ?? "",
    industry: (row.industry as string) ?? "",
    keywords: (row.keywords as string[]) ?? [],
    avoid_words: (row.avoid_words as string[]) ?? [],
    example_posts: (row.example_posts as string[]) ?? [],
    system_prompt: (row.system_prompt as string) ?? "",
    logo_url: (row.logo_url as string) ?? "",
    colors: (row.colors as string[]) ?? [],
    is_default: Boolean(row.is_default),
    handle: (row.handle as string) ?? "",
    profile_photo_url: (row.profile_photo_url as string) ?? "",
    website: (row.website as string) ?? "",
    social_links: (row.social_links as Record<string, string>) ?? {},
    values: (row.values as string) ?? "",
  };
}

/** Converte a marca no formato que generate-content (IA de texto) espera. */
export function brandTextProfile(b?: BrandProfile | null): BrandProfileForAI | undefined {
  if (!b?.name) return undefined;
  return {
    name: b.name,
    description: b.description || undefined,
    tone: b.tone || "profissional",
    targetAudience: b.target_audience || undefined,
    industry: b.industry || undefined,
    keywords: b.keywords?.length ? b.keywords : undefined,
    avoidWords: b.avoid_words?.length ? b.avoid_words : undefined,
    examplePosts: b.example_posts?.length ? b.example_posts : undefined,
    systemPrompt: b.system_prompt || undefined,
  };
}

/**
 * Diretiva de estilo visual para prompts de IMAGEM (gpt-image-*).
 * A marca vira a base estética: paleta, tom e valores guiam o visual.
 * Por padrão evita renderizar texto/logo (modelos erram logotipos) — o logo
 * real é sobreposto depois, fora da geração.
 */
export function brandImageDirective(b?: BrandProfile | null): string {
  if (!b?.name) return "";
  const parts: string[] = [];
  if (b.colors?.length) parts.push(`paleta de cores base ${b.colors.join(", ")}`);
  if (b.tone) parts.push(`estética alinhada ao tom ${b.tone}`);
  if (b.industry) parts.push(`contexto do setor de ${b.industry}`);
  if (b.values) parts.push(`refletindo os valores: ${b.values}`);
  const style = parts.length ? `Identidade visual da marca ${b.name}: ${parts.join("; ")}.` : "";
  return `${style} Não renderize texto, palavras nem logotipos na imagem, a menos que explicitamente pedido.`.trim();
}

/**
 * Diretiva de estilo para prompts de VÍDEO.
 * Diferente da de imagem: foca em movimento/cinematografia e NÃO proíbe texto
 * (vídeo pode ter fala/legenda). A marca guia estética, ritmo e tom.
 */
export function brandVideoDirective(b?: BrandProfile | null): string {
  if (!b?.name) return "Cinematografia profissional, movimento suave e enquadramento limpo.";
  const visual: string[] = [];
  if (b.colors?.length) visual.push(`paleta ${b.colors.join(", ")}`);
  if (b.industry) visual.push(`contexto do setor de ${b.industry}`);
  if (b.values) visual.push(`refletindo os valores: ${b.values}`);
  const style = visual.length ? `Estética da marca ${b.name}: ${visual.join("; ")}.` : `Estética da marca ${b.name}.`;
  const tone = b.tone ? ` Ritmo/tom alinhado a "${b.tone}".` : "";
  return `${style}${tone} Cinematografia profissional, movimento suave e enquadramento limpo.`.trim();
}

/** Diretiva de narração/voz (áudio do vídeo) a partir do tom da marca. */
export function brandVoiceDirective(b?: BrandProfile | null): string {
  const tone = b?.tone || "profissional";
  return `Narração em português brasileiro, voz ${tone}, natural e clara.`;
}

/** Linha de assinatura/handle para legendas e carrosséis (a marca como raiz textual). */
export function brandSignature(b?: BrandProfile | null): string {
  if (!b) return "";
  return b.handle || b.name || "";
}

/**
 * Contexto curto da marca para system prompts de IA de TEXTO (aiAssist):
 * nome, handle, tom, público, valores e palavras a evitar.
 */
export function brandTextHint(b?: BrandProfile | null): string {
  if (!b?.name) return "";
  const p: string[] = [`Marca: ${b.name}${b.handle ? ` (${b.handle})` : ""}.`];
  if (b.tone) p.push(`Tom de voz: ${b.tone}.`);
  if (b.target_audience) p.push(`Público-alvo: ${b.target_audience}.`);
  if (b.values) p.push(`Valores: ${b.values}.`);
  if (b.avoid_words?.length) p.push(`Evite as palavras: ${b.avoid_words.join(", ")}.`);
  if (b.system_prompt) p.push(b.system_prompt);
  return p.join(" ");
}
