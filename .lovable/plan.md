## Problema

A aplicação está fazendo chamadas para `https://placeholder.supabase.co` em vez do backend real (`wggbiyatfvighvutrpca.supabase.co`), com erro `Failed to fetch`. Sem conexão ao backend, o login não funciona — e sem login não há como conectar redes sociais.

Evidência (do log de rede):
```
GET https://placeholder.supabase.co/rest/v1/system_settings...
apikey: placeholder-anon-key
Error: Failed to fetch
```

## Causa

O arquivo `.env` já tem os valores corretos (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` apontando para `wggbiyatfvighvutrpca`), mas foram preenchidos **após** o Vite iniciar — então o bundle servido no preview ainda contém o fallback `placeholder.supabase.co` definido em `src/integrations/supabase/client.ts`.

Os secrets do backend (POSTFORME_API_KEY etc.) já estão configurados, então o proxy `postforme-proxy` funciona — o que falta é apenas o frontend conseguir falar com o backend para autenticar o usuário.

## Correção

Reiniciar o dev server do Vite para que ele releia o `.env` e injete as variáveis corretas no bundle do navegador. Nenhuma alteração de código é necessária.

## Verificação após o restart

1. Abrir o preview e confirmar que `/login` carrega sem erros de rede.
2. Fazer login / criar conta.
3. Em **Contas → Conectar Rede**, escolher uma plataforma e confirmar que o popup OAuth do Post for Me abre corretamente e a conta aparece como conectada.

Se após o restart ainda houver erro ao conectar uma rede específica, eu investigo o fluxo de OAuth daquela plataforma (logs do edge function `postforme-proxy` + resposta de `pfm_auth_url`).
