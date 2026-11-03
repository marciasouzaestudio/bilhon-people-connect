CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text NOT NULL,
  display_name text,
  profile_image_url text,
  followers integer DEFAULT 0,
  following integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  engagement_rate numeric,
  avg_likes integer,
  avg_comments integer,
  avg_views integer,
  recent_posts jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_snapshots_user ON public.analytics_snapshots(user_id);
CREATE INDEX idx_analytics_snapshots_platform ON public.analytics_snapshots(platform, username);
CREATE INDEX idx_analytics_snapshots_fetched ON public.analytics_snapshots(fetched_at DESC);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots" ON public.analytics_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.analytics_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapshots" ON public.analytics_snapshots FOR DELETE USING (auth.uid() = user_id);