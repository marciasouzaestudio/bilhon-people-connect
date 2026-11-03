---
name: social-hub-autopilot
description: O Autopilot do Social Hub / start-clean-bloom — criador automático de conteúdo (curadoria→confirmação→full-auto). Cobre a máquina de estados (draft→approved→scheduling→active→published), o cron, o pipeline autopilot-run e os hooks/UI. Use ao mexer em automação, agendamento recorrente ou geração em lote.
---

# Social Hub — Autopilot (automação de conteúdo)

Rota `/autopilot` (`src/pages/Autopilot.tsx` + `src/components/autopilot/*`). Pesquisa tópicos → gera posts em lote → gera visuais → agenda → publica via PFM, com recorrência e aprovação opcional. Backend: `autopilot-cron` (gatilho periódico) + `autopilot-run` (pipeline). Tabelas em skill `social-hub-data-model`. Plano original em `docs/AUTOPILOT_REFORM.md`.

## Máquina de estados (`autopilot_calendars.status`)
```
draft        → recém-gerado (research + posts rascunho)
  ↓ aprovar (auto se requires_approval=false; senão usuário clica "Aprovar tudo")
approved
  ↓ schedule (gera visuais)
scheduling   → esperando visuais (ex.: vídeo Higgsfield assíncrono)
  ↓ check_visuals (polling até completar)
active       → visuais prontos
  ↓ confirm (publica na PFM)
published
```
`autopilot_posts.status`: draft|scheduled|published|failed.

## Ações do pipeline (`autopilot-run`, disparadas por cron ou UI)
1. **generate** — carrega config (research_topics, brand, platforms, posts_per_cycle, content_types). Firecrawl `/v1/scrape` direto nas `research_urls` + search nos tópicos → sumariza → `generate-content` por plataforma (com `_shared/brand.ts` brandToAIProfile) → cria `autopilot_calendar` (draft) + N `autopilot_posts`.
2. **curate** — ranqueia/filtra (auto se requires_approval=false; senão espera o usuário).
3. **schedule** — por post, gera visual conforme `image_provider`/`visual_provider`: **openai** (gpt-image-2 síncrono, upload storage) ou **higgsfield** (vídeo, assíncrono). `visual_format='video'` usa `video_model` + `hf_text_to_video_direct` + polling. Marca calendário como `scheduling`.
4. **check_visuals** — cron pola visuais pendentes; ao completar, atualiza `media_urls` e promove. **Bug já corrigido:** quando não há visual pendente, devolve o calendário a `approved` (antes ficava preso em `scheduling`).
5. **confirm** — `pfmCreatePost()` com mídia+legenda+plataformas, guarda `pfm_post_id`, status→published, salva em `creations`.

## Reforma já implementada (commits c920186 + 0421d66)
- F1: usa `generate-content` (não mais Gemini inline) + `content_types` + `_shared/brand.ts`.
- F2: `image_provider` = **openai** (gpt-image-2 síncrono). O Wizard fixa `image_provider: "openai"`.
- F3: `visual_format='video'` + `video_model`; text-to-video + polling por provider no check_visuals.
- F4: `research_urls` via Firecrawl `/v1/scrape` direto (antes `site:` no search).
- F5: wizard com formato Vídeo, provider de imagem, modelo de vídeo + "Melhorar com IA" por post no `AutopilotPostCard`.

## Hooks & UI (`src/hooks/use-autopilot.ts`, `src/components/autopilot/`)
- `useAutopilotConfigs`, `useAutopilotCalendars`, `useRunAutopilot` (manual generate), `useApproveCalendar`, `useScheduleCalendar`, `useConfirmCalendar`, `useCurateCalendar`.
- `AutopilotWizard` (criar config), `AutopilotCalendarView` (ver/editar/aprovar posts do ciclo), `AutopilotPostCard` (texto, preview de imagem, status, refino IA).

## Lacunas/riscos
- Sem rollback: falha no meio do `autopilot-run` pode travar calendário em `scheduling` (mitigado no check_visuals, mas não há retry manual de UI robusto).
- Firecrawl 402 → research vazia → posts sem contexto de pesquisa.
- `visual_provider` ⊂ {openai, higgsfield}. `check_visuals` só pola higgsfield (vídeo); imagem openai é síncrona. (Blotato removida no commit 32ae69f.)
- `brand_id` é nullable; UI não força escolher marca (recomendado, mas opcional).
