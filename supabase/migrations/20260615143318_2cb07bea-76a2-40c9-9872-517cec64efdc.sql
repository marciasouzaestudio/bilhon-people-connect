alter table public.autopilot_configs
  add column if not exists themes jsonb not null default '[]'::jsonb,
  add column if not exists reference_accounts text[] not null default '{}',
  add column if not exists tone text;

alter table public.autopilot_posts
  add column if not exists theme_name text,
  add column if not exists visual_format text;