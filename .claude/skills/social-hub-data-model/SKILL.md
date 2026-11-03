---
name: social-hub-data-model
description: Esquema do banco (Supabase/Postgres) do Social Hub / start-clean-bloom — tabelas, colunas, RLS, função get_vault_secret, storage bucket. Use ao mexer em queries, migrations, RLS ou ao planejar mudanças de dados no pivô. Toda tabela é isolada por user_id via RLS.
---

# Social Hub — Modelo de Dados

Postgres no Supabase (ref `rajgstqxyprkphuvsmft`). **Toda tabela tem RLS habilitado e isola por `auth.uid() = user_id`** (políticas select/insert/update/delete espelhadas). Trigger `handle_updated_at()` (SECURITY DEFINER) mantém `updated_at`. Colunas foram adicionadas incrementalmente por várias migrations — confira o estado atual no banco antes de assumir.

## Tabelas

### `user_configs` (chaves de API por usuário — 1 linha por user, unique user_id)
Origem: `20260328000001_create_user_configs.sql` (só tinha `blotato_api_key NOT NULL`, `brand_name`, `brand_logo_url`). Colunas adicionadas depois:
- **Ativas:** `postforme_api_key` (PFM — core), `higgsfield_api_id`, `higgsfield_api_secret`, `firecrawl_api_key`, `pexels_api_key`, `apify_api_token`, `onboarding_completed` (bool, default false).
- **Legado/órfãs (presentes mas pouco/não usadas):** `anthropic_api_key`, `unsplash_api_key` (Pexels venceu o Unsplash). (`blotato_api_key` foi DROPADA na migration `20260613000001` — Blotato removida.)
- `brand_name` (default 'Mega Automação'), `brand_logo_url`.

### `brand_profiles` (marca-raiz — ver skill `social-hub-brand-and-providers`)
Origem `20260328200000`. Colunas: `name`, `description`, `tone` (default 'profissional'), `target_audience`, `industry`, `keywords[]`, `avoid_words[]`, `example_posts[]`, `system_prompt`, `logo_url`, `colors[]`, `is_default` (bool). Adicionadas depois: `handle`, `profile_photo_url`, `website`, `social_links` (jsonb), `values`.

### `creations` (galeria de mídia gerada)
`type` ('image'|'video'|'carousel'), `urls[]`, `thumbnail_url`, `prompt`, `template_id`, `template_name`, `source_id`, `metadata` (jsonb), `published` (bool). Índices por (user, created_at) e (user, type). Salvo via `src/lib/gallery.ts` (`saveVisualToGallery`); data: URLs sobem pro storage automaticamente (commit 86b259a).

### `saved_sources` (fontes para curadoria/Autopilot)
`source_type`, `title`, `content`, `reference_url`, `custom_instructions`.

### `post_history` (log de publicações — opcional)
`platform`, `account_id`, `post_submission_id`, `text_content`, `media_urls[]`, `status` (pending|published|scheduled|failed), `public_url`, `error_message`, `scheduled_time`, `published_at`.

### `analytics_snapshots` (cache Apify)
`platform`, `username`, `followers`, `following`, `posts_count`, `engagement_rate`, `avg_likes`, `avg_comments`, `avg_views`, `recent_posts` (jsonb), `fetched_at`. Índice `(user_id, platform, username, fetched_at desc)`.

### Tabelas do Autopilot (migration `20260409000001_autopilot_tables.sql` + `20260526170000_autopilot_studio_power.sql`)
- **`autopilot_configs`** (blueprint por marca): `brand_id`→brand_profiles (nullable), `research_topics[]`, `research_urls[]`, `platforms[]`, `social_account_ids[]`, `posts_per_cycle`, `visual_format` ('auto'|'image'|'carousel'|'video'), `content_types[]` (default educativo/inspirador/prático), `recurrence`, `preferred_days[]`, `preferred_times[]`, `timezone`, `is_active`, `requires_approval`, `next_run_at`, `last_run_at`, `image_provider` (default 'openai'), `video_model` (nullable).
- **`autopilot_calendars`** (1 ciclo/lote): `config_id`→configs (cascade), `cycle_start`, `cycle_end`, `status` (máquina de estados — ver skill `social-hub-autopilot`), `research_results` (jsonb).
- **`autopilot_posts`** (post dentro do calendário): `calendar_id`→calendars (cascade), `platform`, `text_content`, `hashtags[]`, `carousel_data` (jsonb), `media_urls[]`, `visual_creation_id`, `scheduled_at`, `pfm_post_id`, `status` (draft|scheduled|published|failed), `error_message`, `source_topic`, `source_url`, `visual_provider` ('openai'|'higgsfield' — só higgsfield é assíncrono/polled).

## Storage
Bucket **`media`** (público). Path `/{user_id}/{arquivo}`. RLS: authenticated insere/lê/deleta só na própria pasta; **anon lê tudo** (compartilhamento público de mídia). Útil pra gerar URL pública de imagem antes de mandar pro Higgsfield/PFM.

## get_vault_secret (SECURITY DEFINER)
`public.get_vault_secret(secret_name text)` (migration `20260526155146`). Dona = postgres (só postgres decripta `vault.secrets`); EXECUTE só pra `service_role`, **revogado de anon/authenticated** ([[feedback-supabase-revoke-public]]). Hoje só o `openai-image` usa (fallback de `OPENAI_API_KEY`). NUNCA pôr valor de secret em migration. Popular Vault é one-off via `lovable_query_sql`.

## Cuidados ao pivotar
- Adicionar coluna sensível? RLS já isola por user — mas confira `WITH CHECK` em policies de insert/update pra colunas auto-promováveis.
- `anon` lê o bucket `media` inteiro — não guardar mídia privada lá sem repensar a policy.
- Colunas legado (`anthropic_api_key`, `unsplash_api_key`) são deletáveis se o pivô não as usar — confirmar que nenhum código ativo lê antes. (`blotato_api_key` já foi dropada.)
