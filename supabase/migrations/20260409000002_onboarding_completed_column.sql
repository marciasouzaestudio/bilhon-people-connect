-- Persistir onboarding_completed no banco (antes era só localStorage)
alter table public.user_configs
  add column if not exists onboarding_completed boolean not null default false;
