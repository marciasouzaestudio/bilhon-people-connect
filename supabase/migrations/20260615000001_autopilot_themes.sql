-- ============================================================
-- Autopilot: temas/motivos complementares + tom + referências
-- ============================================================
-- Cada config passa a ter N "temas" (motivos de postagem) distribuídos no
-- calendário (ex.: seg=Tema A, qua=Tema B). Cada tema: assunto próprio,
-- formato, dias, contas de Instagram de referência e tom opcionais.
-- Retrocompatível: sem temas, o autopilot continua usando research_topics.

alter table public.autopilot_configs
  add column if not exists themes jsonb not null default '[]'::jsonb,
  add column if not exists reference_accounts text[] not null default '{}',
  add column if not exists tone text;

-- Estrutura de cada item em themes (jsonb):
-- {
--   "id": "t1",
--   "name": "Bastidores",
--   "subject": "bastidores da produção e novidades da semana",
--   "visual_format": "auto" | "carousel" | "single" | "infographic" | "video" | null,
--   "reference_accounts": ["@conta1", "@conta2"],   -- contas de IG de referência (opcional)
--   "tone": "descontraído",                          -- override do tom (opcional)
--   "days": [1,3,5],                                  -- dias da semana deste tema (opcional)
--   "content_types": ["educativo","inspirador"]      -- override (opcional)
-- }

-- Rastreia qual tema gerou cada post (para o calendário/UI) e o formato
-- escolhido pelo tema (o schedule usa este, com fallback no config).
alter table public.autopilot_posts
  add column if not exists theme_name text,
  add column if not exists visual_format text;

-- 'daily' agora é um recurrence válido (sem constraint a alterar — coluna é text).
