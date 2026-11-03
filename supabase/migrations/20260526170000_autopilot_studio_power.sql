-- Autopilot com o poder de fogo do Studio: provider de imagem (OpenAI/Blotato),
-- vídeo (Higgsfield) e rastreio de qual provider gerou o visual (para o polling).

alter table public.autopilot_configs
  add column if not exists image_provider text not null default 'openai',
  add column if not exists video_model text;

-- visual_format é text (sem enum) — 'video' já é aceito sem alterar constraint.

alter table public.autopilot_posts
  add column if not exists visual_provider text; -- 'blotato' | 'openai' | 'higgsfield'
