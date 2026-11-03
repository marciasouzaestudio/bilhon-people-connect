-- 1. Bucket de mídia
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Users can upload media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read own media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public can read media"
  on storage.objects for select
  to anon
  using (bucket_id = 'media');

create policy "Users can delete own media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Tabela de criações (galeria)
create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'image',
  urls text[] not null default '{}',
  thumbnail_url text,
  prompt text,
  template_id text,
  template_name text,
  source_id text,
  metadata jsonb default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.creations enable row level security;

create policy "Users can read own creations"
  on public.creations for select using (auth.uid() = user_id);
create policy "Users can insert own creations"
  on public.creations for insert with check (auth.uid() = user_id);
create policy "Users can update own creations"
  on public.creations for update using (auth.uid() = user_id);
create policy "Users can delete own creations"
  on public.creations for delete using (auth.uid() = user_id);

create index idx_creations_user on public.creations (user_id, created_at desc);
create index idx_creations_type on public.creations (user_id, type);

-- 3. Perfis de empresa (brand profiles)
create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  tone text not null default 'profissional',
  target_audience text,
  industry text,
  keywords text[] default '{}',
  avoid_words text[] default '{}',
  example_posts text[] default '{}',
  system_prompt text,
  logo_url text,
  colors text[] default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;

create policy "Users can read own profiles"
  on public.brand_profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profiles"
  on public.brand_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profiles"
  on public.brand_profiles for update using (auth.uid() = user_id);
create policy "Users can delete own profiles"
  on public.brand_profiles for delete using (auth.uid() = user_id);

create trigger brand_profiles_updated_at
  before update on public.brand_profiles
  for each row execute function public.handle_updated_at();

-- 4. Fontes salvas (persistente)
create table if not exists public.saved_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  source_type text not null,
  title text,
  content text,
  reference_url text,
  custom_instructions text,
  created_at timestamptz not null default now()
);

alter table public.saved_sources enable row level security;

create policy "Users can read own sources"
  on public.saved_sources for select using (auth.uid() = user_id);
create policy "Users can insert own sources"
  on public.saved_sources for insert with check (auth.uid() = user_id);
create policy "Users can delete own sources"
  on public.saved_sources for delete using (auth.uid() = user_id);

create index idx_saved_sources_user on public.saved_sources (user_id, created_at desc);