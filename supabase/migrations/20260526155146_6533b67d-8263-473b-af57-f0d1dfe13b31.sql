create or replace function public.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $func$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$func$;

revoke all on function public.get_vault_secret(text) from public, anon, authenticated;
grant execute on function public.get_vault_secret(text) to service_role;