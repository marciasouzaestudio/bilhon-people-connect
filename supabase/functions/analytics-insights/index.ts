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
    const { analytics, mode } = await req.json();

    if (!analytics?.length) {
      return new Response(JSON.stringify({ error: "Sem dados de analytics" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!lovableApiKey) throw new Error("GEMINI_API_KEY não configurada.");

    // Build rich data context
    const totalFollowers = analytics.reduce((s: number, a: any) => s + (a.followers ?? 0), 0);
    const avgEngagement = analytics.filter((a: any) => a.engagementRate != null)
      .reduce((s: number, a: any, _i: number, arr: any[]) => s + (a.engagementRate ?? 0) / arr.length, 0);

    const allPosts = analytics.flatMap((a: any) =>
      (a.recentPosts ?? []).map((p: any) => ({ ...p, platform: a.platform }))
    );

    // Compute best day of week from posts
    const dayMap: Record<string, { total: number; engagement: number }> = {};
    const hourMap: Record<string, { total: number; engagement: number }> = {};
    allPosts.forEach((p: any) => {
      if (!p.date) return;
      const d = new Date(p.date);
      const dayName = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()];
      const hour = `${d.getHours()}h`;
      const eng = (p.likes ?? 0) + (p.comments ?? 0);
      if (!dayMap[dayName]) dayMap[dayName] = { total: 0, engagement: 0 };
      dayMap[dayName].total++;
      dayMap[dayName].engagement += eng;
      if (!hourMap[hour]) hourMap[hour] = { total: 0, engagement: 0 };
      hourMap[hour].total++;
      hourMap[hour].engagement += eng;
    });

    const bestDays = Object.entries(dayMap)
      .map(([day, v]) => ({ day, avgEng: v.total > 0 ? v.engagement / v.total : 0, posts: v.total }))
      .sort((a, b) => b.avgEng - a.avgEng);

    const bestHours = Object.entries(hourMap)
      .map(([hour, v]) => ({ hour, avgEng: v.total > 0 ? v.engagement / v.total : 0, posts: v.total }))
      .sort((a, b) => b.avgEng - a.avgEng);

    // Per-platform summary
    const platformSummaries = analytics.map((a: any) => {
      const posts = a.recentPosts ?? [];
      const topPost = posts.sort((x: any, y: any) => (y.likes ?? 0) - (x.likes ?? 0))[0];
      const avgLikesRecent = posts.length > 0 ? posts.reduce((s: number, p: any) => s + (p.likes ?? 0), 0) / posts.length : 0;
      const avgCommentsRecent = posts.length > 0 ? posts.reduce((s: number, p: any) => s + (p.comments ?? 0), 0) / posts.length : 0;
      return {
        plataforma: a.platform,
        usuario: a.username,
        seguidores: a.followers,
        seguindo: a.following,
        totalPosts: a.posts,
        taxaEngajamento: a.engagementRate,
        mediaLikesGeral: a.avgLikes,
        mediaComentariosGeral: a.avgComments,
        mediaViewsGeral: a.avgViews,
        likesRecentes: Math.round(avgLikesRecent),
        comentariosRecentes: Math.round(avgCommentsRecent),
        topPost: topPost ? {
          texto: topPost.text?.slice(0, 150),
          likes: topPost.likes,
          comentarios: topPost.comments,
          views: topPost.views,
          data: topPost.date,
        } : null,
        postsAnalisados: posts.length,
      };
    });

    const dataContext = JSON.stringify({
      visaoGeral: {
        totalSeguidores: totalFollowers,
        engajamentoMedio: avgEngagement.toFixed(2),
        totalPlataformas: analytics.length,
        totalPostsAnalisados: allPosts.length,
      },
      melhorDia: bestDays.slice(0, 3),
      melhorHorario: bestHours.slice(0, 5),
      plataformas: platformSummaries,
    }, null, 2);

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "per-platform") {
      systemPrompt = `Você é um analista de marketing digital sênior. Analise os dados REAIS fornecidos e gere insights ESPECÍFICOS e ACIONÁVEIS para CADA plataforma individualmente.

REGRAS:
- Use APENAS os dados fornecidos, NUNCA invente números
- Seja específico: cite números reais dos dados
- Cada recomendação deve ser concreta e executável
- Identifique padrões nos posts de maior performance
- Compare métricas entre plataformas
- Responda em português brasileiro
- Responda APENAS com JSON válido, sem markdown`;

      userPrompt = `Analise estes dados e gere insights POR PLATAFORMA:

${dataContext}

Retorne JSON com esta estrutura:
{
  "platforms": {
    "<nome_plataforma>": {
      "score": <0-100 nota geral>,
      "status": "<crescendo | estável | em declínio | iniciando>",
      "resumo": "<2 frases sobre a performance atual>",
      "pontoForte": "<o que está funcionando bem, com dados>",
      "pontoFraco": "<o que precisa melhorar, com dados>",
      "acoes": ["<ação concreta 1>", "<ação concreta 2>", "<ação concreta 3>"],
      "frequenciaIdeal": "<ex: 4-5x por semana>",
      "tipoConteudoRecomendado": "<ex: carrosséis educativos, vídeos curtos>",
      "benchmarkSetor": "<como se compara com médias do setor>"
    }
  }
}`;
    } else {
      systemPrompt = `Você é o diretor de estratégia digital de uma agência top. Analise os dados REAIS de redes sociais e produza um relatório estratégico profundo e completo.

REGRAS CRÍTICAS:
- Use EXCLUSIVAMENTE os dados fornecidos — não invente números
- Cite métricas específicas dos dados (ex: "sua taxa de 3.2% no Instagram")
- Cada recomendação deve ser concreta e executável esta semana
- Analise padrões temporais (melhores dias/horários já calculados)
- Compare plataformas entre si para identificar onde focar
- Identifique o que os posts de melhor performance têm em comum
- Responda em português brasileiro
- Responda APENAS com JSON válido`;

      userPrompt = `Produza uma análise estratégica COMPLETA com estes dados reais:

${dataContext}

Retorne JSON com esta estrutura:
{
  "resumoExecutivo": "<parágrafo de 3-4 linhas com visão macro>",
  "scoreGeral": <0-100>,
  "melhorPlataforma": {
    "nome": "<plataforma>",
    "motivo": "<por que, com dados>"
  },
  "piorPlataforma": {
    "nome": "<plataforma>",
    "motivo": "<por que, com dados>"
  },
  "melhorDiaParaPostar": {
    "dia": "<dia da semana>",
    "motivo": "<baseado nos dados de engajamento>"
  },
  "melhorHorario": {
    "horario": "<faixa horária>",
    "motivo": "<baseado nos dados>"
  },
  "analiseEngajamento": {
    "status": "<excelente | bom | médio | precisa melhorar>",
    "detalhes": "<análise detalhada com números>",
    "comparacaoSetor": "<como se compara com benchmarks>"
  },
  "topInsights": [
    {
      "titulo": "<insight curto>",
      "descricao": "<explicação com dados>",
      "prioridade": "<alta | média | baixa>",
      "categoria": "<crescimento | engajamento | conteúdo | frequência | audiência>"
    }
  ],
  "planoAcao": [
    {
      "acao": "<o que fazer>",
      "plataforma": "<onde>",
      "impactoEsperado": "<resultado esperado>",
      "prazo": "<esta semana | este mês | próximo mês>"
    }
  ],
  "oportunidades": ["<oportunidade 1>", "<oportunidade 2>", "<oportunidade 3>"],
  "riscos": ["<risco 1>", "<risco 2>"]
}`;
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
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

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { error: "Falha ao parsear resposta", raw: cleaned.slice(0, 500) };
    }

    // Include computed data alongside AI insights
    const result = {
      ai: parsed,
      computed: {
        bestDays: bestDays.slice(0, 7),
        bestHours: bestHours.slice(0, 12),
        totalFollowers,
        avgEngagement: avgEngagement.toFixed(2),
        totalPosts: allPosts.length,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("analytics-insights error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
