-- Persistir Higgsfield API keys no banco (antes ficavam só em localStorage)
alter table public.user_configs
  add column if not exists higgsfield_api_id text,
  add column if not exists higgsfield_api_secret text;
