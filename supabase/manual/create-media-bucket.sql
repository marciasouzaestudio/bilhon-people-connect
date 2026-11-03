-- Cria o bucket de storage 'media' no backend central auytmefqnuzbktyzcled.
-- Rodar no SQL editor do Supabase (schema storage). Aditivo e seguro.
--
-- POR QUE: o app persiste imagens geradas por IA (gpt-image-2 devolve base64 →
-- data URL) subindo pro bucket 'media'. Esse bucket NÃO existe neste projeto
-- (upload retorna "Bucket not found"), então imagens de IA e uploads do Lab
-- NÃO salvam na galeria nem ficam publicáveis. Vídeos (Higgsfield) e fotos do
-- Pexels salvam porque são URLs http, não passam pelo bucket.
-- A migration 20260328200000_v2_gallery_brands_sources.sql cria isto, mas nunca
-- foi aplicada no backend central (as migrations do repo não governam este DB).

-- 1) Bucket público 'media'
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 2) Políticas RLS (o path começa com <user_id>/… — bate com auth.uid())
drop policy if exists "Users can upload media" on storage.objects;
create policy "Users can upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read own media" on storage.objects;
create policy "Users can read own media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public can read media" on storage.objects;
create policy "Public can read media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists "Users can delete own media" on storage.objects;
create policy "Users can delete own media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
