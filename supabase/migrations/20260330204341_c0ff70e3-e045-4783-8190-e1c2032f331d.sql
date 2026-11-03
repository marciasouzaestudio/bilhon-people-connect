ALTER TABLE public.user_configs
ADD COLUMN IF NOT EXISTS postforme_api_key text,
ADD COLUMN IF NOT EXISTS anthropic_api_key text,
ADD COLUMN IF NOT EXISTS unsplash_api_key text,
ADD COLUMN IF NOT EXISTS pexels_api_key text,
ADD COLUMN IF NOT EXISTS apify_api_token text;