# Testes de integração — social ("Social Hub" / `app_social`)

Suíte de **regressão pós-swap** do remix **Social Hub** contra o **banco
central** `auytmefqnuzbktyzcled` (schemas `core` + `app_social` +
`analytics_core`). Prova, com testes reais contra o Supabase central, que cada
par **rota → ação** continua funcionando sob a RLS/edges/schema centralizados e
que o **isolamento por tenant** (tenant = `user_id`, sem organização) segue
intacto após a fusão dos dados de todos os remixes.

> Fonte de verdade das linhas testadas: `solutions/docs/test-integration-ledger.md`
> (seção "LEDGER — social"). O harness é o canônico descrito nesse mesmo arquivo.

## Pré-requisitos (a suíte PRESSUPÕE)

1. **Banco central montado** — schemas `core` e `app_social` criados e populados
   com as policies RLS de `app_social` (escopo por `user_id`,
   `auth.uid() = user_id`). Tabelas: `user_configs`, `brand_profiles`,
   `creations`, `post_history`, `saved_sources`, `analytics_snapshots`,
   `autopilot_configs`, `autopilot_calendars`, `autopilot_posts`,
   `system_settings`, `user_roles`.
2. **Edges deployadas** no central (com prefixo/gate corretos): `postforme-proxy`,
   `generate-content`, `ai-assist`, `openai-image`, `higgsfield-proxy`,
   `stock-search`, `firecrawl-search`, `source-extract`, `social-analytics`,
   `analytics-insights`, `brand-suggest`, `autopilot-run` (+ `autopilot-cron`).
3. **Storage** — bucket `media` criado com policy de escrita por prefixo
   `/{user_id}/...`.
4. **RPC** — `get_vault_secret(secret_name)` presente com `EXECUTE` **só** para
   `service_role` (deve negar usuário comum/anon).
5. **Repoint feito** — URL/anon/service-role apontando para o central.
6. **PostgREST expõe** os schemas `core` e `app_social` (usado via `.schema(...)`).

## Como rodar

1. Instale as devDependencies ausentes no repo (o repo já usa `vitest`):

   ```bash
   npm i -D vitest @supabase/supabase-js
   ```

   (Não é preciso `dotenv`: um loader próprio — `setup.env.ts` — lê `.env.test`.)

2. Copie o exemplo e preencha com o **central**:

   ```bash
   cp tests/integration/.env.test.example .env.test
   # editar .env.test com TEST_SUPABASE_URL / ANON / SERVICE_ROLE do central
   ```

   > `.env.test` contém a **service-role key** — NUNCA commitar. Garanta que
   > está no `.gitignore`.

3. Execute (sequencial, timeout 30s):

   ```bash
   npx vitest run -c tests/integration/vitest.integration.config.ts
   ```

## Variáveis de ambiente (`.env.test`)

| Var | Descrição |
|---|---|
| `TEST_SUPABASE_URL` | URL do projeto central |
| `TEST_SUPABASE_ANON_KEY` | anon/publishable key (clients autenticados via RLS) |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | service-role (seed/teardown — bypassa RLS) |
| `TEST_APP_SCHEMA` | opcional; default `app_social` |

## O que a suíte cobre

Um arquivo por rota/feature do inventário (`src/App.tsx`):

| Arquivo | Rota | Cobertura |
|---|---|---|
| `auth.test.ts` | /login, /signup, /forgot-password, /update-password | system_settings flag, signIn/signUp, reset, updateUser |
| `setup.test.ts` | /setup | user_configs CRUD + deny + edges de validação de chave |
| `dashboard.test.ts` | /dashboard | edges postforme-proxy / social-analytics / generate-content |
| `accounts.test.ts` | /accounts | postforme-proxy (list / auth_url / disconnect) |
| `studio.test.ts` | /studio | brand_profiles + edges de geração/publicação + storage media (+deny) |
| `gallery.test.ts` | /gallery | creations CRUD + deny + storage media |
| `analytics.test.ts` | /analytics | postforme-proxy / social-analytics / analytics-insights (2 modos) |
| `lab.test.ts` | /lab | generate-content + insert creations + storage media |
| `schedule.test.ts` | /schedule | postforme-proxy (scheduled/delete) + post_history CRUD + deny |
| `sources.test.ts` | /sources | saved_sources CRUD + deny + source-extract |
| `brands.test.ts` | /brands | brand_profiles CRUD + toggle is_default + deny + storage + brand-suggest |
| `insights.test.ts` | /insights | analytics_snapshots (latest) + deny + generate-content |
| `autopilot.test.ts` | /autopilot | autopilot_configs/calendars/posts CRUD + máquina de estados + deny + autopilot-run |
| `admin.test.ts` | /admin | user_roles guard + deny + system_settings + get_vault_secret (nega) |

### Convenções de asserção

- **crud-rls (positivo):** o dono (user A) insere/lê/atualiza/deleta suas linhas.
- **deny-cross-tenant:** user B **não** vê/edita linhas de A (0 linhas ou erro).
  Uma linha de deny por tabela org-scoped (aqui: `user_id`-scoped).
- **edge:** `functions.invoke` **tolerante a gate** (`invokeTolerant`). O audit do
  social confirma edges **sem `verify_jwt`** (F1 — Denial-of-Wallet) e várias
  dependem de chaves de provedor externo (PFM, Pexels, Apify, Firecrawl,
  Higgsfield, OpenAI, Lovable AI). As asserções garantem apenas que o usuário
  autenticado **alcança o handler** (a chamada resolve com `data` ou `error`),
  tolerando 4xx/5xx externos. Pós-fix (gate `verify_jwt` + validação de
  `auth.uid()`), endurecer para negar anon.
- **rpc `get_vault_secret`:** é `SECURITY DEFINER` com `EXECUTE` só para
  `service_role` — a suíte assevera que **usuário comum e anon são negados**
  (audit #6: Vault travado).
- **storage `media`:** upload em `/{user_id}/...` pelo dono (positivo) + deny de
  escrita na pasta alheia. O bucket é público hoje (audit #3), então o deny
  testado é o de **escrita** (RLS por prefixo); pós-fix (bucket privado + signed
  URLs), adicionar deny de leitura.

## Isolamento

Cada arquivo cria seus próprios tenants em `beforeAll` (user A, e user B quando
há deny) e limpa tudo em `afterAll` via `cleanup` (apaga o auth user com cascata
+ linhas residuais de `app_social` + org core best-effort). A execução é
estritamente **sequencial** (sem `test.concurrent`) para determinismo. A única
exceção compartilhada é `system_settings` (tabela global, sem `user_id`): o teste
de admin restaura o valor original e só remove a linha se ela mesma a criou.
