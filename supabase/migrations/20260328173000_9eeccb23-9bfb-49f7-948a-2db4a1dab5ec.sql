create table if not exists public.user_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  blotato_api_key text not null,
  brand_name text not null default 'Mega Automação',
  brand_logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_configs_user_id_unique unique (user_id)
);

alter table public.user_configs enable row level security;

create policy "Users can read own config"
  on public.user_configs for select
  using (auth.uid() = user_id);

create policy "Users can insert own config"
  on public.user_configs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own config"
  on public.user_configs for update
  using (auth.uid() = user_id);

create policy "Users can delete own config"
  on public.user_configs for delete
  using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_configs_updated_at
  before update on public.user_configs
  for each row execute function public.handle_updated_at();

create table if not exists public.post_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null,
  account_id text not null,
  post_submission_id text,
  text_content text,
  media_urls text[] default '{}',
  status text not null default 'pending',
  public_url text,
  error_message text,
  scheduled_time timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.post_history enable row level security;

create policy "Users can read own posts"
  on public.post_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own posts"
  on public.post_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.post_history for update
  using (auth.uid() = user_id);

create index if not exists idx_post_history_user_status
  on public.post_history (user_id, status, created_at desc);

create index if not exists idx_post_history_platform
  on public.post_history (user_id, platform, created_at desc);