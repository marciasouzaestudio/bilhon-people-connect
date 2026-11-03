import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { name, description, industry } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "Nome da marca é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!lovableApiKey) throw new Error("GEMINI_API_KEY não configurada.");

    const prompt = `Analise esta marca e sugira automaticamente os campos para um perfil de marketing digital.
OBRIGATÓRIO: Responda inteiramente em português brasileiro (pt-BR). Todos os campos devem estar em português.

MARCA: ${name}
${description ? `DESCRIÇÃO: ${description}` : ""}
${industry ? `SETOR: ${industry}` : ""}

Retorne JSON puro com:
{
  "tone": "um dos: profissional, casual, tecnico, inspirador, humoristico, educativo",
  "target_audience": "público-alvo sugerido",
  "industry": "setor sugerido",
  "keywords": ["5-8 palavras-chave relevantes"],
  "avoid_words": ["3-5 palavras/termos a evitar"],
  "description": "descrição curta e impactante se não fornecida",
  "values": "missão e valores sugeridos",
  "system_prompt": "instruções personalizadas para a IA gerar conteúdo desta marca"
}

Responda APENAS com JSON válido.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em branding e marketing digital. Responda apenas com JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("brand-suggest error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
