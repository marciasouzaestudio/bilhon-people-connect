create table if not exists public.autopilot_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_id uuid references public.brand_profiles(id) on delete set null,
  research_topics text[] not null default '{}',
  research_urls text[] default '{}',
  platforms text[] not null default '{}',
  social_account_ids text[] not null default '{}',
  posts_per_cycle int not null default 5,
  visual_format text not null default 'auto',
  content_types text[] default '{"educativo","inspirador","prático"}',
  recurrence text not null default 'weekly',
  preferred_days int[] default '{1,3,5}',
  preferred_times text[] default '{"09:00","18:00"}',
  timezone text not null default 'America/Sao_Paulo',
  is_active boolean not null default false,
  requires_approval boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autopilot_configs enable row level security;

create policy "Users manage own autopilot configs" on public.autopilot_configs for all using (auth.uid() = user_id);

create table if not exists public.autopilot_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  config_id uuid references public.autopilot_configs(id) on delete cascade not null,
  cycle_start date not null,
  cycle_end date not null,
  status text not null default 'draft',
  research_results jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autopilot_calendars enable row level security;

create policy "Users manage own autopilot calendars" on public.autopilot_calendars for all using (auth.uid() = user_id);

create table if not exists public.autopilot_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  calendar_id uuid references public.autopilot_calendars(id) on delete cascade not null,
  platform text not null,
  text_content text not null,
  hashtags text[] default '{}',
  carousel_data jsonb,
  media_urls text[] default '{}',
  visual_creation_id text,
  scheduled_at timestamptz,
  pfm_post_id text,
  status text not null default 'draft',
  error_message text,
  source_topic text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autopilot_posts enable row level security;

create policy "Users manage own autopilot posts" on public.autopilot_posts for all using (auth.uid() = user_id);

alter table public.user_configs add column if not exists firecrawl_api_key text;