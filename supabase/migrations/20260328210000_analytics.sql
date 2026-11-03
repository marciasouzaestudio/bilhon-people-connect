-- =====================================================
-- Analytics storage (cached Apify results)
-- =====================================================

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null,
  username text not null,
  followers integer not null default 0,
  following integer not null default 0,
  posts_count integer not null default 0,
  engagement_rate numeric(5,2),
  avg_likes integer,
  avg_comments integer,
  avg_views integer,
  display_name text,
  profile_image_url text,
  recent_posts jsonb default '[]',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.analytics_snapshots enable row level security;

create policy "Users can read own analytics"
  on public.analytics_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert own analytics"
  on public.analytics_snapshots for insert with check (auth.uid() = user_id);

-- Index for quick lookup of latest snapshot per account
create index idx_analytics_latest
  on public.analytics_snapshots (user_id, platform, username, fetched_at desc);

-- Keep only last 90 days of snapshots (cleanup via cron or manual)
