-- Remoção completa da Blotato.
-- A Blotato foi 100% substituída: contas/publicação → Post for Me, imagens →
-- OpenAI gpt-image-2, vídeo → Higgsfield, fontes → Firecrawl (source-extract).
-- Nenhum código ativo lê ou escreve mais blotato_api_key, e a edge function
-- blotato-proxy foi deletada. Removemos a coluna legada.
ALTER TABLE public.user_configs DROP COLUMN IF EXISTS blotato_api_key;
