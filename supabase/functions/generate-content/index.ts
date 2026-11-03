import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * AI Content Generation Edge Function
 * Uses Google Gemini API for text generation
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLATFORM_GUIDELINES: Record<string, string> = {
  instagram: `Instagram: até 2200 chars. Use emojis, quebras de linha, 5-10 hashtags relevantes no final. Tom visual e inspirador. Inclua CTA.`,
  twitter: `Twitter/X: máximo 280 chars. Conciso, direto, hook forte. 1-2 hashtags. Tom conversacional.`,
  facebook: `Facebook: até 500 chars ideal. Tom pessoal e engajador. Perguntas para gerar comentários.`,
  linkedin: `LinkedIn: até 1300 chars ideal. Tom profissional. Storytelling com lições práticas. 3-5 hashtags.`,
  tiktok: `TikTok: até 300 chars. Linguagem jovem e direta. Emojis. Hook forte.`,
  pinterest: `Pinterest: até 500 chars. Descritivo e útil. Keywords para SEO.`,
  threads: `Threads: até 500 chars. Tom casual e autêntico.`,
  bluesky: `Bluesky: até 300 chars. Tom casual e inteligente.`,
  youtube: `YouTube (descrição): até 500 chars. SEO-friendly. CTA para inscrição.`,
};

interface RequestBody {
  prompt: string;
  platforms: string[];
  tone?: string;
  language?: string;
  sourceContent?: string;
  brandProfile?: {
    name: string;
    description?: string;
    tone: string;
    targetAudience?: string;
    industry?: string;
    keywords?: string[];
    avoidWords?: string[];
    examplePosts?: string[];
    systemPrompt?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { prompt, platforms, tone, language, sourceContent, brandProfile } = body;

    if (!prompt || !platforms?.length) {
      return new Response(
        JSON.stringify({ error: "Missing 'prompt' and 'platforms'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = language || "português brasileiro";
    const toneGuide = brandProfile?.tone || tone || "profissional mas acessível";

    let brandContext = "";
    if (brandProfile) {
      const parts: string[] = [];
      parts.push(`PERFIL DA MARCA: ${brandProfile.name}`);
      if (brandProfile.description) parts.push(`Sobre: ${brandProfile.description}`);
      parts.push(`Tom de voz: ${brandProfile.tone}`);
      if (brandProfile.targetAudience) parts.push(`Público-alvo: ${brandProfile.targetAudience}`);
      if (brandProfile.industry) parts.push(`Setor: ${brandProfile.industry}`);
      if (brandProfile.keywords?.length) parts.push(`Palavras-chave: ${brandProfile.keywords.join(", ")}`);
      if (brandProfile.avoidWords?.length) parts.push(`NUNCA use: ${brandProfile.avoidWords.join(", ")}`);
      if (brandProfile.examplePosts?.length) {
        parts.push(`Exemplos de posts:`);
        brandProfile.examplePosts.forEach((p, i) => parts.push(`  ${i + 1}. ${p}`));
      }
      if (brandProfile.systemPrompt) parts.push(`Instruções adicionais: ${brandProfile.systemPrompt}`);
      brandContext = `\n\n${parts.join("\n")}`;
    }

    const platformInstructions = platforms
      .map((p) => PLATFORM_GUIDELINES[p] || `${p}: crie conteúdo adequado.`)
      .join("\n\n");

    const sourceContext = sourceContent
      ? `\n\nCONTEÚDO DE REFERÊNCIA:\n---\n${sourceContent.slice(0, 3000)}\n---`
      : "";

    const systemPrompt = `Você é uma agência de marketing digital completa. Crie uma campanha de conteúdo em ${lang}.${brandContext}

REGRAS IMPORTANTES:
- OBRIGATÓRIO: Todo o conteúdo DEVE ser em português brasileiro (pt-BR). Nunca gere textos em inglês ou outro idioma.
- Tom: ${toneGuide}
- Cada plataforma deve ter conteúdo DIFERENTE e OTIMIZADO
- NÃO inclua prefixos como "Instagram:" no texto dos posts
- O carrossel deve ter 4-6 slides com frases impactantes e concisas
- Keywords de busca de imagem devem ser em português brasileiro
- Hashtags devem ser em português brasileiro
- Responda APENAS com JSON válido, sem markdown, sem code blocks

DIRETRIZES POR PLATAFORMA:
${platformInstructions}

FORMATO DE RESPOSTA (JSON puro):
{
  "posts": {
    "<platform>": "<texto do post>"
  },
  "carousel": {
    "title": "<título do carrossel>",
    "slides": [
      { "heading": "<frase curta impactante>", "body": "<texto de apoio 1-2 linhas>" }
    ]
  },
  "imageKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "visualSuggestion": "<tipo: tutorial-carousel | quote-card | infographic | slideshow>",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`;

    const userMessage = `Crie uma campanha completa para: ${platforms.join(", ")}

TEMA: ${prompt}${sourceContext}

Gere: posts por plataforma + carrossel de 4-6 slides + 5 keywords para busca de imagens + sugestão de visual + 5 hashtags.

Responda com JSON puro.`;

    // Use Lovable AI Gateway
    const lovableApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!lovableApiKey) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }

    console.log("[generate-content] Calling Lovable AI Gateway...");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-content] AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        throw new Error("Rate limit excedido. Tente novamente em alguns segundos.");
      }
      if (response.status === 402) {
        throw new Error("Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.");
      }
      throw new Error(`Erro na API de IA ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;

    if (!textContent) {
      throw new Error("Sem conteúdo na resposta da IA");
    }

    console.log("[generate-content] Got AI response, parsing JSON...");

    let parsed: Record<string, unknown>;
    try {
      const cleaned = textContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const posts: Record<string, string> = {};
      for (const p of platforms) posts[p] = textContent;
      parsed = {
        posts,
        carousel: { title: prompt, slides: [{ heading: prompt, body: textContent.slice(0, 100) }] },
        imageKeywords: prompt.split(" ").slice(0, 5),
        visualSuggestion: "tutorial-carousel",
        hashtags: [],
      };
    }

    console.log("[generate-content] Success!");

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("generate-content error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
