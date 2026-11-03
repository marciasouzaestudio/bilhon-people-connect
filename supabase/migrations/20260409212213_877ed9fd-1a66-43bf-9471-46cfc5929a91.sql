
alter table public.user_configs add column if not exists onboarding_completed boolean not null default false;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'autopilot-hourly-check',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://scrwjzkqopzwzplnaznz.supabase.co/functions/v1/autopilot-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
