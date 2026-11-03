# Social Hub — automação de conteúdo para redes sociais (curadoria → criação → publicação → autopilot)

> Parte do ecossistema **Bilhon-OS** — produto **SOCIAL** para automação de conteúdo em redes sociais. Objetivos globais e convenções: ../../CLAUDE.md · Auditoria completa: `audit/` (gitignored — contém anon key, JWT e PII; **nunca commitar/expor**).

## O que é
App web (SPA) que gera e publica conteúdo para redes sociais a partir de uma **marca-raiz** (brand-as-root): o usuário define a marca, e toda geração de imagem/vídeo/legenda herda essa identidade. Núcleo é o **Studio** (criação assistida por IA ou canvas manual) + o **Autopilot** (curadoria → confirmação → full-auto, com calendário e cron) + o módulo **Criativos** (`/criativos`: anúncios para Meta Ads a partir de uma oferta estruturada, com a marca como guia de branding — ver skill `social-hub-creatives`). Publicação real via **Post for Me (PFM)**. Origem: remix Lovable `start-clean-bloom` (repo upstream `MindOpsTeam/start-clean-bloom`).

## Stack
- **Frontend:** Vite 5 + React 18 + TypeScript (SPA, sem SSR). Template Lovable Remix (`lovable-tagger`).
- **UI:** TailwindCSS 3 + shadcn/ui (Radix) + `lucide-react`; animação `framer-motion`/`motion`, `@react-spring/web`, `lottie-react`; gráficos `recharts`; toasts `sonner`.
- **Dados/estado:** `@tanstack/react-query` (fetch/cache) · `react-router-dom` v6 · `react-hook-form` + `zod`.
- **Backend:** Supabase (Postgres + Auth/GoTrue + Storage + Edge Functions Deno) — ref **`rajgstqxyprkphuvsmft`** (ativa nos scripts) / **`wggbiyatfvighvutrpca`** (projeto migrado no `config.toml`, sem anon key local).
- **IA/integrações:** Lovable AI Gateway (Gemini), OpenAI gpt-image, Higgsfield (vídeo), Pexels, Firecrawl, Apify. **Blotato foi removida por completo** (commit `32ae69f`).
- **Idioma da UI:** pt-BR.

## Comandos
```bash
npm run dev         # servidor de desenvolvimento (Vite)
npm run dev:e2e     # dev no modo e2e (auth stub / mocks)
npm run build       # build de produção — rodar (0 erros) ANTES de commitar
npm run build:dev   # build em modo development
npm run lint        # eslint
npm run preview     # servir o build
npm run test        # vitest (run único)
npm run test:watch  # vitest em watch
```

## Estrutura
```
src/
├── pages/            # telas de rota (Studio, Autopilot, Dashboard, Brands, Analytics, ...)
├── components/
│   ├── studio/       # o núcleo Studio: workspace/ (canvas, copilot, publish drawer, output)
│   ├── autopilot/    # calendário + status badges do autopilot
│   ├── creatives/    # módulo Criativos (Meta Ads): OfferDialog, CreativeWizard, CreativeSetView, CreativeCard
│   ├── layout/       # AppLayout (shell autenticado)
│   ├── setup/        # steps de onboarding
│   ├── analytics/    # PostPerformance
│   └── ui/           # shadcn/ui (Radix)
├── hooks/            # use-autopilot, use-brands, use-role, use-social, use-mobile, use-toast
├── contexts/         # AuthContext (sessão) + AppContext (config/onboarding)
├── lib/
│   ├── api/          # camada de providers (barrel @/lib/api) — ver abaixo
│   ├── brand.ts      # modelo de marca-raiz
│   ├── creatives.ts  # Criativos: tipos, prompt de imagem, CRUD (+ creative-engine.ts, meta-creative-specs.ts)
│   ├── gallery.ts    # storage/galeria (bucket media)
│   ├── platforms.tsx # metadados por plataforma social
│   └── supabase.ts   # client
├── integrations/supabase/types.ts   # tipos gerados do schema
└── bilhon-motion/    # camada de motion Bilhon (MaquinaCli)
```
Camada de providers `src/lib/api/*` (re-exportada por `@/lib/api`): `postforme` (PFM — CORE: contas/post/agendamento/upload/analytics), `content` (generate-content), `openai` (gpt-image), `higgsfield` (vídeo), `ai-assist`, `analytics`, `firecrawl`, `sources` (source-extract), `_shared` (internos, não exportados).

## Rotas (src/App.tsx — 18)
- **Guest (GuestOnly):** `/login` · `/signup` · `/forgot-password` · `/update-password`.
- **Onboarding:** `/setup` (RequireAuth).
- **Shell autenticado** (`RequireAuth > RequireOnboarding > AppLayout`): `/dashboard` · `/accounts` · **`/studio`** · **`/criativos`** · `/gallery` · `/analytics` · `/lab` · `/schedule` · `/sources` · `/brands` · `/insights` · **`/autopilot`** · `/admin` (RequireAdmin, via `use-role`).
- **Aposentadas → `/studio`:** `/create` · `/carousel` · `/visuals`. Raiz `/` → `/login`; `*` → NotFound.

## Backend & dados — Supabase `rajgstqxyprkphuvsmft`
- **Schema-alvo de centralização:** `app_social` (identidade compartilhada em `core`).
- **Tabelas-chave (11, todas com RLS `auth.uid() = user_id`):** `user_configs` · `brand_profiles` · `creations` · `post_history` · `saved_sources` · `analytics_snapshots` · `autopilot_configs` · `autopilot_calendars` · `autopilot_posts` · `user_roles` · `system_settings`.
- **Criativos (3, RLS por org no `app_social` do central):** `creative_offers` · `creative_sets` · `creatives`. DDL em `supabase/migrations-central/` (aplicada via MCP; `supabase/migrations/` é o legado `public.` do remix).
- **RPC (3):** `get_vault_secret(text)` (SECURITY DEFINER, EXECUTE só service_role) · `has_role` · `handle_updated_at` (trigger).
- **Edge Functions (Deno, `/functions/v1/*`, deployadas no central como `social_<nome>`):** `postforme-proxy` (PFM, CORE) · `generate-content` · `openai-image` · `higgsfield-proxy` · `ai-assist` · `brand-suggest` · `stock-search` (Pexels) · `firecrawl-search` · `source-extract` · `social-analytics` (Apify) · `analytics-insights` · `autopilot-cron` · `autopilot-run` · `veo-generate` · **`creative-generate`** e **`creative-image`** (módulo Criativos) · [órfã: `image-search`; removida: `blotato-proxy`]. Chaves de terceiros chegam **por header do usuário** (`x-pfm-api-key`, `x-higgsfield-*`, `x-firecrawl/pexels/apify/openai-*`); funções de IA própria usam `LOVABLE_API_KEY` do env.
- **Buckets:** `media` (`public=true`), path `/{user_id}/{arquivo}`.
- **Colisões de tabela com outras solutions (centralization-pilot):** `user_roles`, `system_settings` → precisam de prefixo/namespacing ao mover para `app_social`.

## Segurança (ver audit/ — todos confirmados por exploração read-only, nada destrutivo)
1. **🔴 Edge functions sem auth (`verify_jwt` off) → Denial-of-Wallet (CONFIRMADO).** 12/13 funções alcançam o handler sem token (sem token → `400`, não `401`; com JWT arbitrário → `200`). **Geração paga real disparada:** `ai-assist`/`generate-content`/`brand-suggest`/`analytics-insights`/`source-extract` → `200` (texto pago no `LOVABLE_API_KEY` do dono); **`openai-image` → `200` gerou imagem na chave OpenAI do Vault do dono (17s)**. → *Correção:* `verify_jwt=true` por função + validar `auth.uid()` antes de gastar token; rate-limit + teto de custo.
2. **🔴 `autopilot-cron` gatilhável sem auth (CONFIRMADO).** `POST` anônimo executa o orquestrador (`200 {generated:0,...}`, no-op só porque nada estava vencido). → *Correção:* exigir service_role ou header-segredo `CRON_SECRET`.
3. **🟠 Storage `media` público + listável por anon (CONFIRMADO).** `object/list/media` (anon) → `200` enumera pastas (= user_ids); qualquer arquivo é baixável por URL pública. → *Correção:* bucket privado + signed URLs (ou policy de leitura por dono).
4. **🟠 Anon key + URL + payloads commitados no git (CONFIRMADO).** Nos `scripts/*.mjs` de debug (anon key `role:anon` do ref `rajgstqxyprkphuvsmft`). Anon key é "pública por design", mas entrega o mapa+chave do backend e potencializa #1–#3. → *Correção:* rotacionar a key, ler credenciais de env, purgar do histórico.
5. **✅ RLS sólida (CONFIRMADO).** Anon lê **0 linhas** nas 11 tabelas; dump autenticado só vê o próprio tenant. Não há dado cross-tenant exfiltrável por anon.
6. **✅ Vault travado (CONFIRMADO).** `rpc/get_vault_secret` (anon/authenticated) → `401 permission denied`.

> Nota: existem **dois project refs vivos** (migração `rajgst…` → `wggbi…`). O sweep rodou no `rajgstqxyprkphuvsmft` (tem anon key local; projeto antigo, dados ~vazios). Os achados #1–#4 provavelmente se repetem no ref atual `wggbiyatfvighvutrpca`.

## Centralização & dashboard
- **source_app:** `social` · **schema-alvo:** `app_social` · identidade em `core`.
- **Papel no modelo canônico:** produtor de eventos de criação/publicação/automação de conteúdo social.
- **Eventos que deve emitir para `analytics_core.events`** (contrato mínimo `source_app · source_project_ref · user_id · organization_id · entity_type · entity_id · event_type · status · occurred_at · metadata`): geração no Studio (`creation`), publicação/agendamento via PFM (`post`/`schedule`), ciclos do Autopilot (`autopilot_run`/`autopilot_post`), snapshots de analytics.
- **Antes de mover dados:** reescrever migrations que apontam para `public.`, revisar RLS/policies, **prefixar Edge Functions** e resolver as colisões `user_roles`/`system_settings`, ajustar o bucket global `media`.

## Convenções
- **UI em pt-BR** — todo texto visível ao usuário em português.
- **Rodar o build antes de commitar** (0 erros).
- **Segredos só em `.env` local / ambiente** — nunca no repo; a anon key é pública por design mas não hardcodar em scripts versionados; `audit/` é gitignored e contém dados reais.
- **Skills locais** (`.claude/skills/`): `social-hub-architecture`, `social-hub-studio`, `social-hub-creatives`, `social-hub-autopilot`, `social-hub-brand-and-providers`, `social-hub-data-model`, `social-hub-edge-functions` — consulte-as ao mexer na área correspondente.
