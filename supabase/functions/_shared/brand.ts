/**
 * Helpers de marca para edge functions (espelham src/lib/brand.ts).
 * A marca é a raiz de toda geração — texto E imagem.
 */

export interface BrandRow {
  name?: string;
  description?: string;
  tone?: string;
  target_audience?: string;
  industry?: string;
  keywords?: string[];
  avoid_words?: string[];
  example_posts?: string[];
  system_prompt?: string;
  logo_url?: string;
  colors?: string[];
  handle?: string;
  profile_photo_url?: string;
  values?: string;
}

/** Converte uma linha de brand_profiles no formato camelCase que generate-content espera. */
export function brandToAIProfile(b?: BrandRow | null) {
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

/** Diretiva de estilo visual para prompts de imagem (paleta/tom/valores como base). */
export function brandImageDirective(b?: BrandRow | null): string {
  if (!b?.name) return "";
  const parts: string[] = [];
  if (b.colors?.length) parts.push(`paleta de cores base ${b.colors.join(", ")}`);
  if (b.tone) parts.push(`estética alinhada ao tom ${b.tone}`);
  if (b.industry) parts.push(`contexto do setor de ${b.industry}`);
  if (b.values) parts.push(`refletindo os valores: ${b.values}`);
  const style = parts.length ? `Identidade visual da marca ${b.name}: ${parts.join("; ")}.` : "";
  return `${style} Não renderize texto, palavras nem logotipos na imagem, a menos que explicitamente pedido.`.trim();
}

/** Diretiva de estilo para prompts de VÍDEO (movimento/cinematografia; permite fala/legenda). */
export function brandVideoDirective(b?: BrandRow | null): string {
  if (!b?.name) return "Cinematografia profissional, movimento suave e enquadramento limpo.";
  const visual: string[] = [];
  if (b.colors?.length) visual.push(`paleta ${b.colors.join(", ")}`);
  if (b.industry) visual.push(`contexto do setor de ${b.industry}`);
  if (b.values) visual.push(`refletindo os valores: ${b.values}`);
  const style = visual.length ? `Estética da marca ${b.name}: ${visual.join("; ")}.` : `Estética da marca ${b.name}.`;
  const tone = b.tone ? ` Ritmo/tom alinhado a "${b.tone}".` : "";
  return `${style}${tone} Cinematografia profissional, movimento suave e enquadramento limpo.`.trim();
}

/** Diretiva de narração/voz a partir do tom da marca. */
export function brandVoiceDirective(b?: BrandRow | null): string {
  const tone = b?.tone || "profissional";
  return `Narração em português brasileiro, voz ${tone}, natural e clara.`;
}
