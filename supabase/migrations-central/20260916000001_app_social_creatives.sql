-- ============================================================
-- Módulo CRIATIVOS (Meta Ads) — schema app_social do banco CENTRAL
-- ============================================================
-- Aplicada no projeto central (auytmefqnuzbktyzcled) via MCP apply_migration.
-- As migrations em supabase/migrations/ são o legado "public." do remix Lovable;
-- o app real roda em app_social (client com db.schema='app_social').
--
-- 3 tabelas, padrão canônico do central (ver .claude/skills/social-hub-data-model):
--   id uuid pk + org_id + user_id + domínio + created_at/updated_at,
--   RLS: leitura core.is_org_member(org_id); escrita idem AND user_id = auth.uid().
--
--   creative_offers  → a OFERTA/PRODUTO abstraído (o "offer canvas"): promessa,
--                      dores, benefícios, provas, mecanismo da oferta, CTA, fotos.
--   creative_sets    → um "conjunto" gerado a partir de 1 oferta + 1 marca
--                      (objetivo, formatos, plano de ângulos da IA, status).
--   creatives        → cada peça final: ângulo × formato, copy (headline /
--                      texto principal / descrição / CTA) + imagem.

-- ─── OFERTAS ────────────────────────────────────────────────────
create table if not exists app_social.creative_offers (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  user_id          uuid references auth.users(id) on delete set null,
  brand_id         uuid references app_social.brand_profiles(id) on delete set null,
  name             text not null,
  product_type     text not null default 'produto',   -- produto|servico|infoproduto|saas|evento|outro
  description      text,
  promise          text,                               -- transformação / promessa central
  target_audience  text,                               -- público específico da oferta (sobrepõe a marca)
  pain_points      text[] not null default '{}',
  benefits         text[] not null default '{}',
  differentiators  text[] not null default '{}',
  objections       text[] not null default '{}',
  social_proof     text[] not null default '{}',
  price            text,
  offer_mechanism  text[] not null default '{}',       -- desconto|bonus|garantia|escassez|frete_gratis|trial|parcelamento
  offer_details    text,                               -- "de R$ 497 por R$ 297 + 3 bônus"
  deadline         text,
  guarantee        text,
  cta_type         text not null default 'LEARN_MORE', -- CTA da Meta (LEARN_MORE, SHOP_NOW, SIGN_UP, ...)
  destination_url  text,
  product_images   text[] not null default '{}',       -- fotos do produto (bucket media)
  source_url       text,                               -- página de vendas usada para preencher com IA
  notes            text,
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_creative_offers_org on app_social.creative_offers (org_id, created_at desc);
create index if not exists idx_creative_offers_brand on app_social.creative_offers (brand_id);

alter table app_social.creative_offers enable row level security;

drop policy if exists creative_offers_org_select on app_social.creative_offers;
create policy creative_offers_org_select on app_social.creative_offers
  for select to authenticated using (core.is_org_member(org_id));
drop policy if exists creative_offers_own_insert on app_social.creative_offers;
create policy creative_offers_own_insert on app_social.creative_offers
  for insert to authenticated with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creative_offers_own_update on app_social.creative_offers;
create policy creative_offers_own_update on app_social.creative_offers
  for update to authenticated
  using (core.is_org_member(org_id) and user_id = auth.uid())
  with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creative_offers_own_delete on app_social.creative_offers;
create policy creative_offers_own_delete on app_social.creative_offers
  for delete to authenticated using (core.is_org_member(org_id) and user_id = auth.uid());

grant select, insert, update, delete on app_social.creative_offers to authenticated;
grant all on app_social.creative_offers to service_role;

drop trigger if exists trg_fill_org_id on app_social.creative_offers;
create trigger trg_fill_org_id before insert on app_social.creative_offers
  for each row execute function app_social.fill_org_id();
drop trigger if exists creative_offers_updated_at on app_social.creative_offers;
create trigger creative_offers_updated_at before update on app_social.creative_offers
  for each row execute function core.set_updated_at();

-- ─── CONJUNTOS ──────────────────────────────────────────────────
create table if not exists app_social.creative_sets (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  user_id       uuid references auth.users(id) on delete set null,
  offer_id      uuid not null references app_social.creative_offers(id) on delete cascade,
  brand_id      uuid references app_social.brand_profiles(id) on delete set null,
  name          text not null,
  objective     text not null default 'conversao',     -- conversao|leads|trafego|reconhecimento|mensagens|engajamento
  formats       text[] not null default '{feed_1x1,feed_4x5,story_9x16}',
  angle_count   integer not null default 4,
  options       jsonb not null default '{}'::jsonb,     -- { textOnArt, useProductPhotos, includeLogo, style, extraDirection }
  plan          jsonb not null default '{}'::jsonb,     -- resposta da IA (ângulos + copy + brief visual)
  status        text not null default 'planning',      -- planning|generating|done|failed
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_creative_sets_org on app_social.creative_sets (org_id, created_at desc);
create index if not exists idx_creative_sets_offer on app_social.creative_sets (offer_id);

alter table app_social.creative_sets enable row level security;

drop policy if exists creative_sets_org_select on app_social.creative_sets;
create policy creative_sets_org_select on app_social.creative_sets
  for select to authenticated using (core.is_org_member(org_id));
drop policy if exists creative_sets_own_insert on app_social.creative_sets;
create policy creative_sets_own_insert on app_social.creative_sets
  for insert to authenticated with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creative_sets_own_update on app_social.creative_sets;
create policy creative_sets_own_update on app_social.creative_sets
  for update to authenticated
  using (core.is_org_member(org_id) and user_id = auth.uid())
  with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creative_sets_own_delete on app_social.creative_sets;
create policy creative_sets_own_delete on app_social.creative_sets
  for delete to authenticated using (core.is_org_member(org_id) and user_id = auth.uid());

grant select, insert, update, delete on app_social.creative_sets to authenticated;
grant all on app_social.creative_sets to service_role;

drop trigger if exists trg_fill_org_id on app_social.creative_sets;
create trigger trg_fill_org_id before insert on app_social.creative_sets
  for each row execute function app_social.fill_org_id();
drop trigger if exists creative_sets_updated_at on app_social.creative_sets;
create trigger creative_sets_updated_at before update on app_social.creative_sets
  for each row execute function core.set_updated_at();

-- ─── CRIATIVOS (peças) ──────────────────────────────────────────
create table if not exists app_social.creatives (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  user_id        uuid references auth.users(id) on delete set null,
  set_id         uuid not null references app_social.creative_sets(id) on delete cascade,
  offer_id       uuid not null references app_social.creative_offers(id) on delete cascade,
  brand_id       uuid references app_social.brand_profiles(id) on delete set null,
  angle_id       text not null,
  angle_name     text not null,
  hook_type      text,                                 -- dor|beneficio|prova_social|oferta|curiosidade|objecao|autoridade|urgencia
  format         text not null,                        -- feed_1x1|feed_4x5|story_9x16
  headline       text not null default '',
  primary_text   text not null default '',
  description    text not null default '',
  cta_type       text not null default 'LEARN_MORE',
  text_overlay   text,                                 -- frase estampada na arte (quando textOnArt)
  image_url      text,
  image_prompt   text,
  status         text not null default 'draft',        -- draft|approved|rejected
  sort_order     integer not null default 0,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_creatives_org on app_social.creatives (org_id, created_at desc);
create index if not exists idx_creatives_set on app_social.creatives (set_id, sort_order);
create index if not exists idx_creatives_offer on app_social.creatives (offer_id);

alter table app_social.creatives enable row level security;

drop policy if exists creatives_org_select on app_social.creatives;
create policy creatives_org_select on app_social.creatives
  for select to authenticated using (core.is_org_member(org_id));
drop policy if exists creatives_own_insert on app_social.creatives;
create policy creatives_own_insert on app_social.creatives
  for insert to authenticated with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creatives_own_update on app_social.creatives;
create policy creatives_own_update on app_social.creatives
  for update to authenticated
  using (core.is_org_member(org_id) and user_id = auth.uid())
  with check (core.is_org_member(org_id) and user_id = auth.uid());
drop policy if exists creatives_own_delete on app_social.creatives;
create policy creatives_own_delete on app_social.creatives
  for delete to authenticated using (core.is_org_member(org_id) and user_id = auth.uid());

grant select, insert, update, delete on app_social.creatives to authenticated;
grant all on app_social.creatives to service_role;

drop trigger if exists trg_fill_org_id on app_social.creatives;
create trigger trg_fill_org_id before insert on app_social.creatives
  for each row execute function app_social.fill_org_id();
drop trigger if exists creatives_updated_at on app_social.creatives;
create trigger creatives_updated_at before update on app_social.creatives
  for each row execute function core.set_updated_at();
