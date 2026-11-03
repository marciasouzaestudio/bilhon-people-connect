-- Blotato agora é legado/opcional — NOT NULL impede inserir user sem chave Blotato.
ALTER TABLE public.user_configs ALTER COLUMN blotato_api_key DROP NOT NULL;
ALTER TABLE public.user_configs ALTER COLUMN blotato_api_key SET DEFAULT '';
