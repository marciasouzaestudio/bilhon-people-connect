/**
 * Especificações de criativos da Meta (Facebook/Instagram Ads) usadas pelo módulo
 * Criativos: formatos/placements, limites de copy, CTAs, objetivos e ganchos.
 *
 * Fonte: recomendações oficiais da Meta para imagem única (2025/2026). Os limites
 * de texto são os "recomendados" (o Ads Manager aceita mais, mas corta na exibição).
 */

// ─── Formatos / placements ──────────────────────────────────────

export type CreativeFormat = "feed_1x1" | "feed_4x5" | "story_9x16";

/** Tamanhos que o gpt-image aceita. O recorte para a proporção final é feito no client. */
export type GenSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface CreativeFormatSpec {
  id: CreativeFormat;
  label: string;
  placement: string;
  /** Proporção final (largura / altura). */
  ratio: number;
  ratioLabel: string;
  /** Resolução recomendada pela Meta. */
  width: number;
  height: number;
  /** Tamanho de geração no gpt-image mais próximo (o client recorta depois). */
  genSize: GenSize;
}

export const CREATIVE_FORMATS: CreativeFormatSpec[] = [
  { id: "feed_1x1", label: "Feed quadrado", placement: "Feed do Facebook e Instagram", ratio: 1, ratioLabel: "1:1", width: 1080, height: 1080, genSize: "1024x1024" },
  { id: "feed_4x5", label: "Feed retrato", placement: "Feed do Instagram (ocupa mais tela)", ratio: 4 / 5, ratioLabel: "4:5", width: 1080, height: 1350, genSize: "1024x1536" },
  { id: "story_9x16", label: "Stories / Reels", placement: "Stories e Reels (Facebook e Instagram)", ratio: 9 / 16, ratioLabel: "9:16", width: 1080, height: 1920, genSize: "1024x1536" },
];

export const DEFAULT_FORMATS: CreativeFormat[] = ["feed_1x1", "feed_4x5", "story_9x16"];

export function formatSpec(id: string): CreativeFormatSpec {
  return CREATIVE_FORMATS.find((f) => f.id === id) || CREATIVE_FORMATS[0];
}

// ─── Limites de copy ────────────────────────────────────────────

export const COPY_LIMITS = {
  headline: { recommended: 40, max: 255 },
  primaryText: { recommended: 125, max: 300 },
  description: { recommended: 30, max: 255 },
} as const;

export type CopyField = keyof typeof COPY_LIMITS;

export type CopyLength = "ok" | "long" | "over";

/** Classifica o comprimento de um campo de copy contra o recomendado/máximo da Meta. */
export function copyLength(field: CopyField, value: string): CopyLength {
  const len = (value || "").length;
  const lim = COPY_LIMITS[field];
  if (len > lim.max) return "over";
  if (len > lim.recommended) return "long";
  return "ok";
}

// ─── CTAs ───────────────────────────────────────────────────────

export const META_CTAS: { value: string; label: string }[] = [
  { value: "LEARN_MORE", label: "Saiba mais" },
  { value: "SHOP_NOW", label: "Comprar agora" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "GET_OFFER", label: "Obter oferta" },
  { value: "BOOK_NOW", label: "Reservar agora" },
  { value: "CONTACT_US", label: "Fale conosco" },
  { value: "DOWNLOAD", label: "Baixar" },
  { value: "GET_QUOTE", label: "Solicitar orçamento" },
  { value: "SUBSCRIBE", label: "Assinar" },
  { value: "WHATSAPP_MESSAGE", label: "Enviar mensagem no WhatsApp" },
  { value: "SEND_MESSAGE", label: "Enviar mensagem" },
  { value: "APPLY_NOW", label: "Inscreva-se" },
  { value: "ORDER_NOW", label: "Pedir agora" },
  { value: "WATCH_MORE", label: "Assista mais" },
];

export function ctaLabel(value?: string | null): string {
  return META_CTAS.find((c) => c.value === value)?.label || value || "Saiba mais";
}

export function normalizeCta(value?: string | null): string {
  const v = (value || "").toUpperCase().replace(/[^A-Z_]/g, "");
  return META_CTAS.some((c) => c.value === v) ? v : "LEARN_MORE";
}

// ─── Objetivos de campanha ──────────────────────────────────────

export type CampaignObjective = "conversao" | "leads" | "trafego" | "reconhecimento" | "mensagens" | "engajamento";

export const OBJECTIVES: { value: CampaignObjective; label: string; hint: string }[] = [
  { value: "conversao", label: "Vendas / Conversão", hint: "O clique precisa virar compra." },
  { value: "leads", label: "Leads", hint: "Captar cadastro ou contato." },
  { value: "trafego", label: "Tráfego", hint: "Levar para o site ou página." },
  { value: "mensagens", label: "Mensagens", hint: "Iniciar conversa no WhatsApp/Direct." },
  { value: "reconhecimento", label: "Reconhecimento", hint: "Posicionar a marca." },
  { value: "engajamento", label: "Engajamento", hint: "Reação, comentário, compartilhamento." },
];

// ─── Tipos de gancho (ângulos) ──────────────────────────────────

export const HOOK_LABELS: Record<string, string> = {
  dor: "Dor",
  beneficio: "Benefício",
  prova_social: "Prova social",
  oferta: "Oferta",
  curiosidade: "Curiosidade",
  objecao: "Objeção",
  autoridade: "Autoridade",
  urgencia: "Urgência",
  comparacao: "Comparação",
  historia: "História",
};

export function hookLabel(hook?: string | null): string {
  if (!hook) return "Ângulo";
  return HOOK_LABELS[hook] || hook;
}

// ─── Tipos de produto e mecanismos de oferta ────────────────────

export const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "produto", label: "Produto físico" },
  { value: "servico", label: "Serviço" },
  { value: "infoproduto", label: "Infoproduto / curso" },
  { value: "saas", label: "Software / app" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

export const OFFER_MECHANISMS: { value: string; label: string }[] = [
  { value: "desconto", label: "Desconto" },
  { value: "bonus", label: "Bônus" },
  { value: "garantia", label: "Garantia" },
  { value: "escassez", label: "Escassez / prazo" },
  { value: "frete_gratis", label: "Frete grátis" },
  { value: "trial", label: "Teste grátis" },
  { value: "parcelamento", label: "Parcelamento" },
];

// ─── Estilos visuais ────────────────────────────────────────────

export const AD_STYLES: { value: string; label: string; directive: string }[] = [
  { value: "auto", label: "Automático (segue o brief)", directive: "" },
  { value: "produto_estudio", label: "Produto em estúdio", directive: "Fotografia de produto em estúdio, fundo limpo, luz suave e controlada, foco nítido no produto, estética premium de e-commerce." },
  { value: "lifestyle", label: "Lifestyle / pessoa real", directive: "Fotografia lifestyle realista com pessoa usando o produto em contexto real, luz natural, expressão autêntica, estética editorial." },
  { value: "ugc", label: "UGC (feito no celular)", directive: "Estética de conteúdo gerado por usuário: foto de celular, luz ambiente, enquadramento espontâneo, sem cara de estúdio, autêntico." },
  { value: "flat", label: "Flat / gráfico", directive: "Design gráfico flat com formas geométricas, cores chapadas da paleta da marca, tipografia forte, sem fotografia." },
  { value: "3d", label: "3D / render", directive: "Render 3D limpo e moderno, materiais realistas, luz volumétrica, composição minimalista." },
  { value: "editorial", label: "Editorial / revista", directive: "Estética editorial de revista: composição sofisticada, contraste marcante, luz dramática, textura fotográfica." },
];

export function styleDirective(value?: string | null): string {
  return AD_STYLES.find((s) => s.value === value)?.directive || "";
}
