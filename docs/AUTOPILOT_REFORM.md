# Autopilot — Estado Atual & Plano de Reforma

> ⚠️ **DOC HISTÓRICO (2026-05).** Registro do planejamento da reforma do Autopilot.
> As menções à **Blotato** descrevem o estado da época. A Blotato foi **removida por
> completo** em 2026-06-13 (commit 32ae69f): imagem = OpenAI gpt-image-2, vídeo =
> Higgsfield, fontes = Firecrawl. `image_provider`/`visual_provider` hoje ⊂ {openai, higgsfield}.

> Objetivo: dar ao Autopilot o **mesmo poder de fogo do Studio** (OpenAI gpt-image-2, vídeo Higgsfield,
> marca-raiz com paleta/valores, IA de texto unificada, refino por IA) mantendo e melhorando a
> **pesquisa de fontes programadas** (Firecrawl).

## 1. Estado atual (mapa)

**Gatilho:** `autopilot-cron` (pg_cron/pg_net) → para cada config ativa com `next_run_at<=agora` dispara `generate`;
calendários `approved` → `schedule`; `scheduling` → `check_visuals`.

**Pipeline `autopilot-run`:**
- **generate**: carrega config + `brand_profiles` + chave Firecrawl do usuário.
  - **Pesquisa (Firecrawl) ✅ existe**: `research_topics` (3 resultados/tópico) + `research_urls` (busca `site:url`).
  - cria `autopilot_calendars` (com `research_results`), calcula slots (dias/horas/timezone), gera 1 post por slot.
  - **Texto: implementação PRÓPRIA inline** (`generatePostContent`) chamando o Lovable AI Gateway
    (`gemini-3-flash`), com contexto de marca montado à mão (name/tone/audience/keywords/avoid/system_prompt).
- **schedule**: se precisa de visual → **Blotato** `create_visual` (templateId = "carousel"/"infographic"/"quote"
  conforme `visual_format`, inputs de marca: authorName/handle/profileImage/logoUrl) → agenda no PFM.
- **check_visuals**: faz polling do status do visual Blotato.

**Wizard / schema:** `visual_format` ∈ auto/carousel/single/infographic/none (**sem vídeo**); `content_types`
existe no schema mas **não é usado** na geração; `brand_id`, `research_topics/urls`, `platforms`,
`social_account_ids`, `posts_per_cycle`, `recurrence`, `preferred_days/times`, `timezone`, `requires_approval`.

## 2. Comparativo de poder de fogo — Studio vs Autopilot

| Capacidade | Studio | Autopilot | Lacuna |
|---|---|---|---|
| Pesquisa de fontes (Firecrawl) | ❌ não tem | ✅ topics + urls | Autopilot já ganha aqui (mas dá p/ melhorar) |
| Texto IA | generate-content + ai-assist (refino, ângulos) | inline gemini one-shot | **divergente, sem refino** |
| Marca-raiz | lib/brand (paleta, valores, brandImageDirective) | inline (sem cores/valores, sem diretiva de imagem) | **parcial** |
| Imagem | **OpenAI gpt-image-2** marca-raiz | ❌ só Blotato template | **falta gpt-image-2** |
| Vídeo | **Higgsfield** (txt→vídeo, img→vídeo, áudio) | ❌ inexistente | **falta vídeo** |
| Carrossel | IA + Canvas + fundo gpt-image por slide | Blotato "carousel" | inferior |
| Imagens stock | ✅ image-search | ❌ | falta |
| Legenda (CTA+hashtags) | ✅ auto-caption | texto+hashtags simples | melhorar |
| Publicar/agendar | PFM (agora/agendar, placement IG) | PFM schedule | ok |

**Conclusão:** o Autopilot **tem** a pesquisa programada, mas a **geração é mais fraca**: não usa OpenAI,
não faz vídeo, a marca-raiz é uma cópia divergente (sem paleta/valores/diretiva de imagem) e o texto não
reaproveita as funções do Studio. Falta também refino por IA e uso de `content_types`.

## 3. Plano de reforma (faseado)

### Fase 1 — Núcleo de IA unificado (sem mudar schema)
- Criar módulo Deno compartilhado `supabase/functions/_shared/brand.ts` espelhando os helpers de `lib/brand`
  (brandTextProfile, brandImageDirective, brandTextHint) para edge functions.
- `autopilot-run` passa a **chamar `generate-content`** (ou usar o mesmo builder de prompt) em vez do gemini
  inline → mesma qualidade/estilo do Studio, mesma marca-raiz. Usar `content_types` no prompt.
- *Risco baixo, ganho alto.*

### Fase 2 — Imagem com OpenAI gpt-image-2
- Novo `image_provider` na config ('openai' | 'blotato'). Para `single`/`auto` com provider openai:
  chamar `openai-image` com prompt marca-raiz (`brandImageDirective`: paleta/tom), subir ao storage `media`,
  setar `media_urls`. Mantém Blotato como opção.

### Fase 3 — Vídeo Higgsfield no Autopilot
- Novo `visual_format: "video"` + `video_model` (catálogo HF_VIDEO_MODELS). Em `schedule`, disparar
  `higgsfield-proxy` `hf_text_to_video_direct` (prompt marca-raiz, áudio pt-BR) → novo status
  `generating_video` + loop de polling (`hfStatus`) análogo ao `check_visuals`.

### Fase 4 — Pesquisa de fontes melhor
- `research_urls`: **scrape direto** da URL (Firecrawl scrape/crawl) em vez de `site:` (conteúdo real, não SERP).
- Sumarizar cada fonte com `ai-assist` (pontos-chave) e **deduplicar/rankear**; opcional: sugerir ângulos por
  tópico (reusar a lógica de "ângulos" do Studio) p/ diversificar os posts do ciclo.

### Fase 5 — Wizard/UI
- Wizard: opção de **vídeo**, escolha de **provider de imagem** (OpenAI/Blotato), modelo de vídeo.
- Calendar view: **"Melhorar com IA"/regenerar por post** (ai-assist), legenda com CTA+hashtags, preview de mídia.

### Schema (migrations)
- `autopilot_configs`: `image_provider text default 'openai'`, permitir `visual_format='video'`,
  `video_model text`.
- `autopilot_posts`: `visual_provider text` (blotato|openai|higgsfield) p/ o polling saber qual status checar
  (hoje `visual_creation_id` é tratado como Blotato).

## 4. Ordem sugerida de execução
F1 (núcleo unificado) → F2 (imagem OpenAI) → F4 (pesquisa melhor) → F3 (vídeo) → F5 (wizard/UI).
Cada fase: tsc+lint+build, commit+push, deploy via Lovable MCP, validação.
