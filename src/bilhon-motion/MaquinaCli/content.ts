// ----------------------------------------------------------------------------
// CONTEÚDO EDITÁVEL (content.ts) — texto/copy dos terminais e ícones-trilha são
// CUSTOMIZÁVEIS por projeto. Ajuste livremente as 6 interações / 5 peças.
// (O motor, os timings e os @keyframes vivem nos outros arquivos — não mexa lá.)
// Copiado por apply-bilhon-ds (make-motion-layer). DROP-IN reversível.
// ----------------------------------------------------------------------------

// =============================================================================
// Bilhon Maquina 5 Pecas — conteudo das 6 interacoes (copy verbatim).
// Portado de: bilhon-brandbook/.../public/bilhon/maquina/animation.js
// I1 (Founder one-shot) + I2-I6 (Customer loop sincronizado).
//
// IMPORTANTE: `html` continua sendo string HTML (com <span class="accent-06">...).
// O tipador de digitacao (useMaquinaEngine) preserva as tags ao inserir char-a-char.
// Conteudo 100% hard-coded/confiavel (nao vem de input do usuario) -> innerHTML OK.
// =============================================================================

export type SwapList = { words: string[]; selected: string };

export type Line = {
  html: string;
  /** linha "estrela" (frase-assinatura secundaria) — gap maior + cor hero */
  star?: boolean;
  /** linha "hero" (frase-assinatura principal, com underline-fade) — gap ainda maior */
  hero?: boolean;
};

export type TermPayload = {
  tab: string;
  cmdHtml: string;
  cmdClass: string;
  outClass: string;
  lines: Line[];
  /** chaves de word-swap presentes no cmdHtml, executadas em sequencia */
  wordSwapKeys?: string[];
  /** linha de transicao diegetica anexada apos o HOLD (somente I1 T2) */
  transitionLine?: { html: string };
};

export type Interaction = {
  summary: string;
  T1: TermPayload;
  T2: TermPayload;
  T3: TermPayload;
};

export type InteractionKey =
  | "I1_FOUNDER"
  | "I2_MOVIMENTO"
  | "I3_AQUISICAO"
  | "I4_MEDIO"
  | "I5_HIGH"
  | "I6_RECORRENCIA";

// ============================================================================
// WORD-SWAP LISTAS CANONICAS
// ============================================================================
export const SWAP_LISTS: Record<string, SwapList> = {
  "i2-niche": { words: ["saúde", "finanças", "educação", "infoproduto", "SaaS"], selected: "mentoria digital" },
  "i3-niche": { words: ["infoproduto", "saúde", "fitness", "finanças", "SaaS"], selected: "mentoria de carreira" },
  "i4-modelo": { words: ["webinar", "workshop", "desafio"], selected: "desafio" },
  "i4-niche": { words: ["consultoria B2B", "wealth management", "fitness premium", "mentoria de carreira"], selected: "wealth management" },
  "i5-niche": { words: ["mentoria empresarial", "wealth management", "executive coaching", "imobiliário luxo", "longevidade"], selected: "mentoria empresarial premium" },
  "i6-tipo": { words: ["saas", "newsletter", "membros", "suplemento", "clube", "comunidade"], selected: "comunidade" },
  "i6-niche": { words: ["saúde", "wealth", "educação", "cultura"], selected: "wealth" },
};

// ============================================================================
// CONTEUDO DAS 6 INTERACOES (T1 esquerda · T2 centro governa · T3 direita)
// ============================================================================
export const INTERACTIONS: Record<InteractionKey, Interaction> = {
  I1_FOUNDER: {
    summary: "Interação 1 de 6: Dashboard do founder. R$ 360M+ cumulativo. 55 mil assinantes. 18 agents ativos.",
    T1: {
      tab: "~/squads · status",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> squad status <span class="accent-01">--all-active</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ 18 agents · 5 peças · 4 contas em paralelo</span>' },
        { html: '&gt; <span class="accent-06">Agent Atlas</span>      mapeando arquitetura de 4 contas       <span class="bilhon-marker-active">●</span>' },
        { html: '&gt; <span class="accent-06">Agent Forja</span>      construindo 3 esteiras GOLD            <span class="bilhon-marker-active">●</span>' },
        { html: '&gt; <span class="accent-06">Agent Cofre</span>      7 instalações de continuidade ativas   <span class="bilhon-marker-active">●</span>' },
        { html: '&gt; <span class="accent-06">Agent Hawk</span>       12 closings em fila high-ticket        <span class="bilhon-marker-active">●</span>' },
        { html: '&gt; <span class="accent-06">Agent Aurora</span>     47 leads sendo recuperadas             <span class="bilhon-marker-active">●</span>' },
      ],
    },
    T2: {
      tab: "~/revenue · live",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> revenue <span class="accent-01">--streams=5 --realtime --since=12y</span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ 5 raios · operação consolidada · auditável</span>' },
        { html: '&gt; MOVIMENTO    <span class="bilhon-marker-progress">━━━━━━━━━━</span> tese-mãe · 55K+ assinantes' },
        { html: '&gt; GOLD         <span class="bilhon-marker-progress">━━━━━━━━━━</span> R$ 140M+ · ⅓ produtores BR' },
        { html: '&gt; MÉDIO        <span class="bilhon-marker-progress">━━━━━━━━━━</span> R$ 220M+ combinado' },
        { html: '&gt; HIGH         <span class="bilhon-marker-progress">━━━━━━━━━━</span> R$ 360M+ vendas próprias' },
        { html: '&gt; RECORRÊNCIA  <span class="bilhon-marker-progress">━━━━━━━━━━</span> 55K+ assinantes em 3 SaaS' },
        { html: '<span class="bilhon-star-secondary">&gt; cumulativo · sem capital externo · sem agências</span>', star: true },
      ],
      // I1 T2 dispara linha extra "transition diegetica" depois do HOLD
      transitionLine: { html: '<span class="bilhon-transition-line">&gt; [client incoming · agents standby]</span>' },
    },
    T3: {
      tab: "~/kpi · audit",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> kpi <span class="accent-01">--audited</span> <span class="accent-01">--since=12y</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Cumulativo Bilhon · 12 anos · auditável</span>' },
        { html: '&gt; Faturamento próprio:     R$ 360M+        <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; Assinantes pagantes:     55.000+         <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; Mercado share GOLD:      ⅓ produtores BR <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; Validação temporal:      12 anos         <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; Capital externo:         0               <span class="bilhon-marker-ok">✓</span>' },
      ],
    },
  },

  I2_MOVIMENTO: {
    summary: "Interação 2 de 6: Movimento. Cliente do nicho mentoria digital. 4 agentes ativos. Resultado: Movimento instalado.",
    T1: {
      tab: "~/diagnose · movimento",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> movement diagnose <span class="accent-01">--leader</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ <span class="accent-06">Agent Bússola</span> + <span class="accent-06">Agent Atlas</span> lendo o terreno...</span>' },
        { html: '&gt; audiência consolidada                          <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; lançamentos esporádicos                        <span class="bilhon-marker-warn">⚠ pico-em-pico</span>' },
        { html: '&gt; engajamento caindo apesar do alcance crescer   <span class="bilhon-marker-warn">⚠</span>' },
        { html: '&gt; referência cultural ausente                    <span class="bilhon-marker-danger">✗ gap detectado</span>' },
        { html: '<span class="bilhon-marker-section">▎ verdict: precisa de tese-mãe · cosmologia · banco MRD</span>' },
      ],
    },
    T2: {
      tab: "~/install · movimento",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> movement install --niche=<span class="bilhon-word-swap" data-swap-key="i2-niche"><span class="bilhon-word-swap__current">saúde</span></span> <span class="accent-01">--voz=fundador</span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      wordSwapKeys: ["i2-niche"],
      lines: [
        { html: '&gt; contexto: <span class="accent-06">mentoria digital</span> · 47 entrevistas ingeridas' },
        { html: '&gt; <span class="accent-06">Agent Bilhon</span> calibra voz do fundador no DNA Schema' },
        { html: '&gt; <span class="accent-06">Agent Manifesto</span> constrói discurso ideológico · Mito Fundador' },
        { html: '&gt; <span class="accent-06">Agent Cruz</span> escreve copy · 23 peças · 0 termos proibidos' },
        { html: '<span class="bilhon-star-secondary">▎ Movimento instalado · cristalização 60-90 dias</span>', star: true },
      ],
    },
    T3: {
      tab: "~/metric · movimento",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> movement measure-installation',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Dashboard MI · Movimento Instalado</span>' },
        { html: '&gt; repetição espontânea da tese    5%/mês target  <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; formação de tribo               100 apóstolos mapeados' },
        { html: '&gt; time-to-tribe                   60-90 dias' },
        { html: '<span class="bilhon-star-secondary">▎ proof: 55K+ assinantes vieram do movimento · não do funil</span>', star: true },
      ],
    },
  },

  I3_AQUISICAO: {
    summary: "Interação 3 de 6: Aquisição GOLD. Nicho mentoria de carreira. 4 agentes. GOLD instalado.",
    T1: {
      tab: "~/diagnose · gold",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> gold diagnose <span class="accent-01">--funnel</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ <span class="accent-06">Agent Bússola</span> lendo consciência do público...</span>' },
        { html: '&gt; lançamento esporádico                  <span class="bilhon-marker-warn">⚠ cada mês começa do zero</span>' },
        { html: '&gt; CAC > ticket                           <span class="bilhon-marker-warn">⚠ tráfego não se paga</span>' },
        { html: '&gt; 30K seguidores · 0 conversão diária    <span class="bilhon-marker-danger">✗</span>' },
        { html: '<span class="bilhon-marker-section">▎ verdict: precisa de Esteira GOLD · pressão interna · 30 dias</span>' },
      ],
    },
    T2: {
      tab: "~/install · gold",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> gold install --niche=<span class="bilhon-word-swap" data-swap-key="i3-niche"><span class="bilhon-word-swap__current">infoproduto</span></span> <span class="accent-01">--pressure=30d</span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      wordSwapKeys: ["i3-niche"],
      lines: [
        { html: '&gt; contexto: <span class="accent-06">mentoria de carreira</span> · GOLD canon · 16 sessões' },
        { html: '&gt; <span class="accent-06">Agent Krueger</span> cunha mecanismo único · "Blueprint da Persuasão"' },
        { html: '&gt; <span class="accent-06">Agent Forja</span> monta stack · 5 bônus · R$ 10K ancorado' },
        { html: '&gt; <span class="accent-06">Agent Paulo</span> ativa Meta Ads + WhatsApp API · 5 criativos' },
        { html: '<span class="bilhon-star-secondary">▎ GOLD instalado · pressão interna em 30 dias</span>', star: true },
      ],
    },
    T3: {
      tab: "~/metric · gold",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> gold measure <span class="accent-01">--activation</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Dashboard ClickMax · Esteira GOLD</span>' },
        { html: '&gt; activation rate target          40-70%   <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; tickets entry                   R$ 27-47' },
        { html: '&gt; histórico canon                 R$ 140M+ em 12 anos' },
        { html: '<span class="bilhon-star-secondary">▎ proof: ⅓ dos produtores digitais BR vieram do GOLD</span>', star: true },
      ],
    },
  },

  I4_MEDIO: {
    summary: "Interação 4 de 6: Médio ticket. Modelo desafio em wealth management. 4 agentes. Médio instalado.",
    T1: {
      tab: "~/diagnose · médio",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> mid diagnose <span class="accent-01">--3-models</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ <span class="accent-06">Agent Atlas</span> detectando gap de pricing...</span>' },
        { html: '&gt; R$ 497  <span class="bilhon-marker-sub">──────────────</span>  R$ 15.000' },
        { html: '&gt; <span class="bilhon-marker-warn">↑ vácuo aqui</span>' },
        { html: '<span class="bilhon-marker-section">▎ verdict: webinar · workshop · OU desafio · 4-6× ano</span>' },
      ],
    },
    T2: {
      tab: "~/install · médio",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> mid install --model=<span class="bilhon-word-swap" data-swap-key="i4-modelo"><span class="bilhon-word-swap__current">webinar</span></span> --niche=<span class="bilhon-word-swap" data-swap-key="i4-niche"><span class="bilhon-word-swap__current">consultoria B2B</span></span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      wordSwapKeys: ["i4-modelo", "i4-niche"],
      lines: [
        { html: '&gt; contexto: <span class="accent-06">wealth management</span> · modelo <span class="accent-06">desafio</span>' },
        { html: '&gt; <span class="accent-06">Agent Outlier</span> prepara produto · DNA do operador calibrado' },
        { html: '&gt; <span class="accent-06">Agent Linchpin</span> orquestra os 3 funis · roteiro · drip' },
        { html: '&gt; <span class="accent-06">Agent Paulo</span> dispara inscrição · countdown · automation' },
        { html: '<span class="bilhon-star-secondary">▎ Médio instalado · 4-6 picos previsíveis por ano</span>', star: true },
      ],
    },
    T3: {
      tab: "~/metric · médio",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> mid measure <span class="accent-01">--rps</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Dashboard · Lançamento desafio</span>' },
        { html: '&gt; tickets band              R$ 1.997 · R$ 3.997' },
        { html: '&gt; frequency target          4-6× ano' },
        { html: '&gt; histórico canon           R$ 220M+ combinado · 3 funis' },
        { html: '<span class="bilhon-star-secondary">▎ peak: R$ 128M em 50 dias · 1 dos 3 funis · 7 sources triangulados</span>', star: true },
      ],
    },
  },

  I5_HIGH: {
    summary: "Interação 5 de 6: High ticket. Nicho mentoria empresarial premium. 5 agentes. High instalado. Inteligência da Bilhon, não artificial, de resultado real.",
    T1: {
      tab: "~/diagnose · high",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> high diagnose <span class="accent-01">--posturing</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ <span class="accent-06">Agent Bússola</span> + <span class="accent-06">Agent Atlas</span> analisando posturing ticket...</span>' },
        { html: '&gt; seu ticket: R$ 2K · mercado: R$ 25K · gap: 12.5×' },
        { html: '&gt; não é audiência · é arquitetura          <span class="bilhon-marker-danger">✗</span>' },
        { html: '<span class="bilhon-marker-section">▎ verdict: 3x3 PER · evento 3 dias · pitch 5 blocos</span>' },
      ],
    },
    T2: {
      tab: "~/install · high",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> high install --niche=<span class="bilhon-word-swap" data-swap-key="i5-niche"><span class="bilhon-word-swap__current">mentoria empresarial</span></span> <span class="accent-01">--pattern=3x3PER</span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      wordSwapKeys: ["i5-niche"],
      lines: [
        { html: '&gt; contexto: <span class="accent-06">mentoria empresarial premium</span> · sofisticação alta' },
        { html: '&gt; <span class="accent-06">Agent Apex</span> constrói funil · landing · VSL · lead scoring' },
        { html: '&gt; <span class="accent-06">Agent Cruz</span> escreve VSL · 5 blocos · 10 técnicas de fechamento' },
        { html: '&gt; <span class="accent-06">Agent Heluany</span> estrutura evento 3 dias · entrega · dor · decisão' },
        { html: '&gt; <span class="accent-06">Agent Hawk</span> closer pronto · NEPQ Mirror calibrado' },
        { html: '       <span class="bilhon-star-line">↳ “Inteligência da Bilhon. Não artificial. De resultado real.”</span>', hero: true },
        { html: '<span class="bilhon-star-secondary">▎ High instalado · 8-10 contratos/mês</span>', star: true },
      ],
    },
    T3: {
      tab: "~/metric · high",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> high measure <span class="accent-01">--close-rate</span> <span class="accent-01">--roi</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Dashboard · 3x3 PER · 8 métricas</span>' },
        { html: '&gt; close rate target           10-20%        <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; ROI target                  ≥ 5×' },
        { html: '&gt; tickets band                R$ 5K · R$ 25K' },
        { html: '<span class="bilhon-star-secondary">▎ canon: R$ 360M+ vendas próprias auditáveis · 0 capital externo</span>', star: true },
      ],
    },
  },

  I6_RECORRENCIA: {
    summary: "Interação 6 de 6: Recorrência. Comunidade em wealth. 4 agentes. Recorrência instalada.",
    T1: {
      tab: "~/diagnose · recorrência",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> recurring diagnose <span class="accent-01">--predictability</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "code-sample",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ <span class="accent-06">Agent Atlas</span> lendo previsibilidade de caixa...</span>' },
        { html: '&gt; <span class="bilhon-marker-spark">▁ ▂ ▆ ▁ ▇ ▁ ▃ ▁ ▆ ▁</span>     ← lançamento esporádico' },
        { html: '&gt; medo de contratar · medo de investir          <span class="bilhon-marker-warn">⚠</span>' },
        { html: '<span class="bilhon-marker-section">▎ verdict: continuidade é o destino · todo sistema flui pra cá</span>' },
      ],
    },
    T2: {
      tab: "~/install · recorrência",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> recurring install --type=<span class="bilhon-word-swap" data-swap-key="i6-tipo"><span class="bilhon-word-swap__current">saas</span></span> --niche=<span class="bilhon-word-swap" data-swap-key="i6-niche"><span class="bilhon-word-swap__current">saúde</span></span>',
      cmdClass: "code-snippet",
      outClass: "command-result",
      wordSwapKeys: ["i6-tipo", "i6-niche"],
      lines: [
        { html: '&gt; contexto: <span class="accent-06">comunidade</span> em <span class="accent-06">wealth</span> · 6-8 semanas' },
        { html: '&gt; <span class="accent-06">Agent Cofre</span> instala eixo · 3 níveis pricing · trial · anual' },
        { html: '&gt; <span class="accent-06">Agent Aurora</span> ativa retenção · onboarding · gamificação' },
        { html: '&gt; <span class="accent-06">Agent Paulo</span> automatiza billing · Iugu · Stripe · PIX' },
        { html: '<span class="bilhon-star-secondary">▎ Recorrência instalada · MRR previsível em 90 dias</span>', star: true },
      ],
    },
    T3: {
      tab: "~/metric · recorrência",
      cmdHtml: '<span class="text-span">$</span> <span class="accent-06">bilhon</span> recurring measure <span class="accent-01">--mrr</span> <span class="accent-01">--churn</span> <span class="accent-01">--ltv</span>',
      cmdClass: "code-sample left-aligned",
      outClass: "xs-mono-text",
      lines: [
        { html: '<span class="bilhon-marker-section">▎ Dashboard ClickMax · Métricas Recorrência</span>' },
        { html: '&gt; MRR growth target           ≥ 15%/mês     <span class="bilhon-marker-ok">✓</span>' },
        { html: '&gt; churn target                < 5%/mês saudável' },
        { html: '&gt; LTV/CAC                     ≥ 3:1' },
        { html: '<span class="bilhon-star-secondary">▎ proof: 55K+ assinantes pagantes em 3 SaaS · sem capital externo</span>', star: true },
      ],
    },
  },
};

/** Ordem do loop de cliente (I2 -> I6) — I1 toca uma vez antes. */
export const INTERACTION_ORDER_LOOP: InteractionKey[] = [
  "I2_MOVIMENTO",
  "I3_AQUISICAO",
  "I4_MEDIO",
  "I5_HIGH",
  "I6_RECORRENCIA",
];
