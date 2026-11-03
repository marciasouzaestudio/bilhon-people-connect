import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * social_creative-generate — cérebro de COPY e ESTRATÉGIA do módulo Criativos (Meta Ads).
 *
 * Dois modos:
 *  - "offer_from_context": recebe texto cru (página de vendas extraída, descrição
 *    do cliente) e devolve a OFERTA estruturada (offer canvas) para preencher o
 *    formulário — promessa, dores, benefícios, provas, mecanismo, CTA.
 *  - "plan": recebe a oferta estruturada + marca + objetivo e devolve N ÂNGULOS
 *    de anúncio, cada um com copy pronta para a Meta (headline ≤ 40, texto
 *    principal ≤ 125 recomendado, descrição ≤ 30) e um BRIEF VISUAL para a arte
 *    (cena, composição, frase estampada, estilo) que o cliente transforma em
 *    prompt de imagem.
 *
 * Hardening (mesmo padrão do social_openai-image): verify_jwt=true + getUser()
 * + rate-limit por usuário. A chave Gemini nunca sai do servidor.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_MODEL = "gemini-3.5-flash";

const RL = new Map<string, number[]>();
function rateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (RL.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { RL.set(key, hits); return false; }
  hits.push(now); RL.set(key, hits); return true;
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Tipos do contrato ──────────────────────────────────────────

interface BrandProfileForAI {
  name: string;
  description?: string;
  tone: string;
  targetAudience?: string;
  industry?: string;
  keywords?: string[];
  avoidWords?: string[];
  examplePosts?: string[];
  systemPrompt?: string;
  colors?: string[];
  values?: string;
}

interface OfferForAI {
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

interface RequestBody {
  mode: "offer_from_context" | "plan";
  // offer_from_context
  context?: string;
  // plan
  offer?: OfferForAI;
  brandProfile?: BrandProfileForAI;
  objective?: string;
  angleCount?: number;
  formats?: string[];
  textOnArt?: boolean;
  extraDirection?: string;
  excludeAngles?: string[];
  language?: string;
}

const OBJECTIVES: Record<string, string> = {
  conversao: "CONVERSÃO/VENDAS: o clique precisa virar compra. Copy orientada a oferta, prova e remoção de risco; CTA transacional.",
  leads: "GERAÇÃO DE LEADS: captar cadastro/contato. Copy orientada a valor imediato da isca e baixo atrito; CTA de cadastro.",
  trafego: "TRÁFEGO: levar ao site/página. Copy curta, curiosidade e promessa clara; CTA 'Saiba mais'.",
  reconhecimento: "RECONHECIMENTO DE MARCA: memorabilidade e posicionamento. Copy de identidade, valores e diferenciação; CTA suave.",
  mensagens: "MENSAGENS (WhatsApp/Direct): iniciar conversa. Copy com pergunta/convite direto; CTA de mensagem.",
  engajamento: "ENGAJAMENTO: reação/comentário/compartilhamento. Copy com identificação, opinião ou pergunta; CTA de interação.",
};

const HOOK_TYPES = "dor | beneficio | prova_social | oferta | curiosidade | objecao | autoridade | urgencia | comparacao | historia";

const CTA_TYPES = "LEARN_MORE | SHOP_NOW | SIGN_UP | GET_OFFER | BOOK_NOW | CONTACT_US | DOWNLOAD | GET_QUOTE | SUBSCRIBE | WHATSAPP_MESSAGE | SEND_MESSAGE | APPLY_NOW | ORDER_NOW | WATCH_MORE";

function brandBlock(b?: BrandProfileForAI): string {
  if (!b?.name) return "";
  const p: string[] = [`MARCA (guia de branding e voz): ${b.name}`];
  if (b.description) p.push(`Sobre: ${b.description}`);
  p.push(`Tom de voz: ${b.tone || "profissional"}`);
  if (b.targetAudience) p.push(`Público-alvo da marca: ${b.targetAudience}`);
  if (b.industry) p.push(`Setor: ${b.industry}`);
  if (b.values) p.push(`Valores: ${b.values}`);
  if (b.colors?.length) p.push(`Paleta visual: ${b.colors.join(", ")}`);
  if (b.keywords?.length) p.push(`Palavras-chave: ${b.keywords.join(", ")}`);
  if (b.avoidWords?.length) p.push(`NUNCA use: ${b.avoidWords.join(", ")}`);
  if (b.examplePosts?.length) p.push(`Exemplos de como a marca escreve:\n${b.examplePosts.map((x, i) => `  ${i + 1}. ${x}`).join("\n")}`);
  if (b.systemPrompt) p.push(`Instruções adicionais da marca: ${b.systemPrompt}`);
  return p.join("\n");
}

function offerBlock(o: OfferForAI): string {
  const p: string[] = [`OFERTA/PRODUTO: ${o.name}${o.productType ? ` (${o.productType})` : ""}`];
  if (o.description) p.push(`O que é: ${o.description}`);
  if (o.promise) p.push(`Promessa central: ${o.promise}`);
  if (o.targetAudience) p.push(`Para quem: ${o.targetAudience}`);
  if (o.painPoints?.length) p.push(`Dores do público: ${o.painPoints.join(" | ")}`);
  if (o.benefits?.length) p.push(`Benefícios: ${o.benefits.join(" | ")}`);
  if (o.differentiators?.length) p.push(`Diferenciais: ${o.differentiators.join(" | ")}`);
  if (o.objections?.length) p.push(`Objeções a derrubar: ${o.objections.join(" | ")}`);
  if (o.socialProof?.length) p.push(`Provas sociais (fatos reais, use-os): ${o.socialProof.join(" | ")}`);
  if (o.price) p.push(`Preço: ${o.price}`);
  if (o.offerMechanism?.length) p.push(`Mecanismo da oferta: ${o.offerMechanism.join(", ")}`);
  if (o.offerDetails) p.push(`Detalhes da oferta: ${o.offerDetails}`);
  if (o.deadline) p.push(`Prazo/escassez: ${o.deadline}`);
  if (o.guarantee) p.push(`Garantia: ${o.guarantee}`);
  if (o.ctaType) p.push(`CTA preferido: ${o.ctaType}`);
  if (o.notes) p.push(`Observações: ${o.notes}`);
  return p.join("\n");
}

async function callGemini(system: string, user: string, temperature: number, maxTokens: number): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[social_creative-generate] gateway error:", response.status, errText);
    if (response.status === 429) throw new Error("Limite de IA excedido. Tente novamente em alguns segundos.");
    if (response.status === 402 || response.status === 403) throw new Error("Créditos de IA indisponíveis no momento.");
    throw new Error(`Erro na API de IA ${response.status}`);
  }

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Última tentativa: recorta do primeiro { ao último }.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("A IA não devolveu JSON válido. Tente novamente.");
  }
}

// ─── Modo 1: oferta a partir de contexto ────────────────────────

async function offerFromContext(body: RequestBody) {
  const context = (body.context || "").trim().slice(0, 12_000);
  if (!context) throw new Error("Informe o contexto (texto da página ou descrição).");

  const system = `Você é estrategista de marketing de resposta direta. Recebe o texto de uma página de vendas, site ou descrição livre e extrai a OFERTA estruturada para alimentar anúncios da Meta.
Regras: responda em português brasileiro; use SOMENTE fatos presentes no contexto (não invente números, preços ou provas); quando um campo não existir no contexto, devolva string vazia ou array vazio; frases curtas e concretas.
${brandBlock(body.brandProfile)}

Responda APENAS JSON com este formato:
{
  "name": "<nome do produto/oferta>",
  "productType": "produto|servico|infoproduto|saas|evento|outro",
  "description": "<o que é, em 1-2 frases>",
  "promise": "<transformação/promessa central em 1 frase>",
  "targetAudience": "<para quem é, específico>",
  "painPoints": ["<dor 1>", "<dor 2>", "<dor 3>"],
  "benefits": ["<benefício 1>", "..."],
  "differentiators": ["<diferencial 1>", "..."],
  "objections": ["<objeção provável 1>", "..."],
  "socialProof": ["<número/depoimento/cliente citado>", "..."],
  "price": "<preço se houver>",
  "offerMechanism": ["desconto"|"bonus"|"garantia"|"escassez"|"frete_gratis"|"trial"|"parcelamento"],
  "offerDetails": "<como a oferta é apresentada: de X por Y, bônus, condições>",
  "deadline": "<prazo/escassez se houver>",
  "guarantee": "<garantia se houver>",
  "ctaType": "${CTA_TYPES.split(" | ")[0]} ou outro da lista: ${CTA_TYPES}",
  "destinationUrl": "<URL de destino se houver>"
}`;

  const result = await callGemini(system, `CONTEXTO:\n---\n${context}\n---\n\nExtraia a oferta estruturada.`, 0.3, 4096);
  return { offer: result };
}

// ─── Modo 2: plano de ângulos + copy + brief visual ─────────────

async function plan(body: RequestBody) {
  const offer = body.offer;
  if (!offer?.name) throw new Error("Informe a oferta (offer.name).");
  const angleCount = Math.min(Math.max(Number(body.angleCount) || 4, 1), 8);
  const objectiveKey = (body.objective || "conversao").toLowerCase();
  const objective = OBJECTIVES[objectiveKey] || OBJECTIVES.conversao;
  const formats = body.formats?.length ? body.formats.join(", ") : "feed_1x1, feed_4x5, story_9x16";
  const textOnArt = body.textOnArt !== false;
  const lang = body.language || "português brasileiro";
  const exclude = (body.excludeAngles || []).filter(Boolean);

  const system = `Você é diretor(a) de criação e copywriter sênior de performance para Meta Ads (Facebook/Instagram). Cria ÂNGULOS de anúncio diversos para a mesma oferta, cada um com copy pronta e um brief visual para a arte.

${brandBlock(body.brandProfile)}

OBJETIVO DA CAMPANHA — ${objective}

REGRAS DE COPY (Meta Ads):
- Tudo em ${lang}. Nada genérico: use os fatos, números e provas da oferta.
- headline: até 40 caracteres, promessa/gancho direto, sem ponto final.
- primary_text: 60 a 125 caracteres no ideal (máximo 300). Gancho na 1ª frase, benefício concreto, CTA implícito. Sem hashtags. No máximo 1 emoji, e só se combinar com o tom da marca.
- description: até 30 caracteres, reforço da oferta (ex.: "Frete grátis hoje", "Vagas limitadas").
- cta_type: escolha o melhor da lista ${CTA_TYPES}, coerente com o objetivo.
- Cada ângulo usa um hook_type DIFERENTE dentre: ${HOOK_TYPES}. Nunca repita ângulo.${exclude.length ? `\n- NÃO repita estes ângulos já usados: ${exclude.join("; ")}.` : ""}
- Respeite as palavras proibidas da marca e as políticas da Meta: nada de promessa de resultado garantido de saúde/dinheiro, nada de "você" acusatório sobre atributos pessoais, sem antes/depois de corpo.

REGRAS DO BRIEF VISUAL (a arte será gerada por IA de imagem, formatos: ${formats}):
- scene: descrição objetiva e fotográfica/ilustrativa da cena em 1-3 frases (o que aparece, ambiente, personagem ou produto em evidência, luz). O sujeito deve ser reconhecível e ligado ao produto real.
- composition: onde fica o produto/sujeito, onde fica o espaço para texto, enquadramento; conteúdo principal CENTRALIZADO e longe das bordas (a arte é recortada para 1:1, 4:5 e 9:16).
- text_overlay: ${textOnArt ? "frase curta (máx. 6 palavras) para estampar na arte, coerente com a headline, em " + lang : "string vazia (a arte NÃO terá texto)"}.
- style: direção estética alinhada à marca (paleta, mood, referência fotográfica: editorial, lifestyle, produto em estúdio, UGC, flat design, 3D...).
- Um ângulo pode ser mais "produto", outro mais "pessoa/resultado", outro mais "prova/número" — varie o visual como varia o hook.

Responda APENAS JSON:
{
  "strategy_note": "<1-2 frases: a lógica do conjunto de ângulos para este objetivo>",
  "angles": [
    {
      "id": "a1",
      "name": "<nome curto do ângulo>",
      "hook_type": "<um de ${HOOK_TYPES}>",
      "rationale": "<por que este ângulo funciona para este público, 1 frase>",
      "headline": "<≤40 chars>",
      "primary_text": "<60-125 chars ideal>",
      "description": "<≤30 chars>",
      "cta_type": "<CTA>",
      "visual": {
        "scene": "<cena>",
        "composition": "<composição>",
        "text_overlay": "<frase ou vazio>",
        "style": "<estilo>"
      },
      "alt_headlines": ["<variação 1>", "<variação 2>"]
    }
  ]
}`;

  const user = `${offerBlock(offer)}\n\n${body.extraDirection ? `DIREÇÃO EXTRA DO CLIENTE: ${body.extraDirection}\n\n` : ""}Gere EXATAMENTE ${angleCount} ângulos.`;
  const result = (await callGemini(system, user, 0.8, 8192)) as { angles?: unknown[]; strategy_note?: string };
  const angles = Array.isArray(result?.angles) ? result.angles : [];
  if (!angles.length) throw new Error("A IA não devolveu ângulos. Tente novamente.");
  return { strategy_note: result.strategy_note || "", angles: angles.slice(0, angleCount) };
}

// ─── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: "Não autorizado" }, 401);
  if (!rateLimit(`creative-generate:${user.id}`)) {
    return json({ error: "Muitas gerações em pouco tempo. Aguarde alguns segundos." }, 429);
  }

  try {
    const body: RequestBody = await req.json();
    console.log(`[social_creative-generate] user=${user.id} mode=${body.mode}`);
    if (body.mode === "offer_from_context") return json(await offerFromContext(body));
    if (body.mode === "plan") return json(await plan(body));
    return json({ error: "mode inválido (offer_from_context | plan)" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[social_creative-generate] error:", message);
    return json({ error: message }, 502);
  }
});
