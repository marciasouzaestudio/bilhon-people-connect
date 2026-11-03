import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Firecrawl Search Proxy
 * Busca conteúdo via Firecrawl REST API para pesquisa automatizada.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-firecrawl-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SearchRequest {
  query: string;
  limit?: number;
  lang?: string;
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
    const apiKey = req.headers.get("x-firecrawl-api-key") || Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-firecrawl-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SearchRequest = await req.json();
    const { query, limit = 5, lang = "pt-br" } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing 'query' in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[firecrawl-search] Searching: "${query}" (limit=${limit})`);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        lang,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[firecrawl-search] API error:", response.status, errText);
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "INSUFFICIENT_CREDITS",
            message: "Firecrawl está sem créditos. Faça upgrade em https://firecrawl.dev/pricing.",
            fallback: true,
            results: [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Firecrawl API ${response.status}: ${errText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Normalizar resultados
    const results = (data.data || []).map((item: Record<string, unknown>) => ({
      url: item.url || "",
      title: (item.metadata as any)?.title || item.title || "",
      markdown: typeof item.markdown === "string" ? item.markdown.slice(0, 2000) : "",
    }));

    console.log(`[firecrawl-search] Found ${results.length} results`);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("firecrawl-search error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
