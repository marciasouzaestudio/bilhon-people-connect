---
name: social-hub-architecture
description: Mapa arquitetural do projeto start-clean-bloom (Social Hub — SaaS multi-tenant de automação de redes sociais, Lovable id 2187fc1f). Use ao planejar QUALQUER mudança/pivô: stack, roteamento, auth, multi-tenancy, fluxo de deploy Lovable, gotcha do project_id e padrão de secrets via Vault. Leia ANTES de mexer em código.
---

# Social Hub — Arquitetura

SaaS multi-tenant onde **cada usuário pluga as próprias chaves de API** (Post for Me, Higgsfield, OpenAI, Pexels, Firecrawl, Apify) e usa IA para criar/publicar conteúdo em redes sociais. Distribuído como template Lovable Remix "as is" (sem suporte — ver constraint do usuário).

- **Repo:** `github.com/MindOpsTeam/start-clean-bloom` → clone em `/Users/barboza/start-clean-bloom`
- **Lovable project_id:** `2187fc1f-e191-4d0e-a27d-39b43d2619c4` (url `start-clean-bloom.lovable.app`)
- **Supabase project ref:** `rajgstqxyprkphuvsmft` (endpoints `rajgstqxyprkphuvsmft.supabase.co/functions/v1`)

## Stack
Vite + React 18 + TypeScript + shadcn/ui (Radix) + Tailwind. Estado: Context API (Auth/App) + TanStack Query (server state) + useReducer (Studio). Roteamento: react-router-dom v6. Backend: Supabase (Postgres + Auth + Storage + Edge Functions em Deno). Export de canvas: `html2canvas` (lazy). Animação: framer-motion. Sem SSR (é Vite SPA, não TanStack Start).

## Roteamento e gates (`src/App.tsx`)
- Páginas de auth (Login/Signup/ForgotPassword/UpdatePassword) carregam eager; resto é `lazy()`.
- `RequireAuth` → exige `user` (pula se auth não configurada = demo mode). `RequireOnboarding` → exige `onboardingCompleted`, senão manda pra `/setup`. `GuestOnly` → loga manda pra `/setup`.
- Layout autenticado: `<RequireAuth><RequireOnboarding><AppLayout/></...>` envolve dashboard, accounts, **studio**, gallery, analytics, lab, schedule, sources, brands, insights, **autopilot**, admin.
- **Telas antigas aposentadas:** `/create`, `/carousel`, `/visuals` → `<Navigate to="/studio">`. O Studio consome `location.state` (deep-links: sourceContent/prompt→briefing, mediaUrls→mídia, scheduleAt→agendar).
- `/` → `/login`. `*` → NotFound.

## Auth & multi-tenancy
- `src/contexts/AuthContext.tsx` envolve Supabase Auth (signUp/signIn/signOut/resetPassword/updatePassword, listener onAuthStateChange). `supabaseConfigured` permite rodar sem auth (demo).
- `src/contexts/AppContext.tsx` espelha `user_configs` (chaves de API por usuário) → localStorage; expõe `config`, `saveConfigToDb()`, `completeOnboarding()`, `onboardingCompleted`, `configLoading`.
- **Isolamento = RLS por `auth.uid() = user_id`** em todas as tabelas + localStorage prefixado por user. O client Supabase manda o JWT automaticamente; cada usuário só vê suas linhas.
- Onboarding: `src/pages/Setup.tsx` + `src/components/setup/*` (SecretInput, steps, ManageKeysView). PFM é o Step obrigatório; resto opcional. `?manage=1` reabre Setup pra editar chaves.

## Padrão de SECRETS via Vault (importante)
- Secrets de plataforma ficam no **Supabase Vault** (`vault.secrets`, criptografado). Edge functions leem via RPC `public.get_vault_secret(name)` — SECURITY DEFINER dona=postgres, execute só pra `service_role` (revogado de anon/authenticated).
- `OPENAI_API_KEY` está no Vault (fallback do `openai-image`). As demais chaves (PFM, Higgsfield, Firecrawl, Pexels, Apify) vêm **do header da request** (chave do próprio usuário), NÃO do Vault.
- `lovable_create_secrets`/`list_secrets` dão **404 neste projeto** — popular Vault via `lovable_query_sql` (write role = postgres). **NUNCA** pôr valor de secret em migration (vai pro git). Popular Vault é one-off fora do versionamento.

## Fluxo de deploy (REGRA — sempre seguir)
Lovable só sincroniza/deploya quando recebe um prompt. Push no GitHub sozinho **não** reflete em produção. Para CADA commit (inclusive frontend-only):
1. editar local → `git commit` → `git push`
2. `mcp__lovable__lovable_send_prompt` com `execute=true` e **`project_id` explícito** pedindo: aplicar o commit recém-pushado + rodar migrations + deployar edge functions.

**Gotcha crítico:** o default do token Lovable MCP é **outro projeto** (não este). SEMPRE passar `project_id=2187fc1f-e191-4d0e-a27d-39b43d2619c4` em cada chamada. O agente Lovable às vezes faz commits próprios ("Changes", "Sincronizou...") e pode gerar migrations espelhando o DB — fazer `git pull --rebase` antes do push; descartar ruído de `package-lock.json` (`git checkout -- package-lock.json`). Deploy de function é assíncrono (~min); confirmar via OPTIONS no endpoint (204 = ok).

## Técnica de refactor segura (já usada aqui)
Extração mecânica pura + verificação `tsc` + `eslint` + `npm run build` (sem runtime) + commit+push por arquivo. Arquivos-monstro que ainda restam como dívida técnica: Analytics.tsx, CreateVisual.tsx (se ainda existirem). Sempre verificar verde antes de commitar.

## Skills irmãs (leia conforme a área)
- `social-hub-data-model` — tabelas, RLS, Vault, storage.
- `social-hub-edge-functions` — 15 functions, ativas vs órfãs.
- `social-hub-studio` — feature núcleo (2 modos, doc model, publish).
- `social-hub-autopilot` — máquina de estados da automação.
- `social-hub-brand-and-providers` — marca-raiz + camada de providers (PFM core; Blotato removida).
