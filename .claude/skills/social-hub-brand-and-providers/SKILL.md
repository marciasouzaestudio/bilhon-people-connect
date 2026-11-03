---
name: social-hub-brand-and-providers
description: Sistema de marca-raiz (brand-as-root) e a camada de providers (src/lib/api/*) do Social Hub / start-clean-bloom — como a identidade da marca atravessa toda geração, e quais APIs estão ativas (PFM core, Higgsfield, OpenAI, Pexels, Firecrawl). A Blotato foi REMOVIDA por completo (commit 32ae69f). Use ao mexer em geração com marca, integração de provider ou ao decidir o que manter no pivô.
---

# Social Hub — Marca-raiz & Providers

## Marca como raiz (brand-as-root)
A identidade da marca (logo/nome/handle/paleta/tom/valores) é a **raiz** de toda geração — texto e imagem herdam dela. Tabela `brand_profiles` (skill `social-hub-data-model`), hook `src/hooks/use-brands.ts`.

**Helpers (`src/lib/brand.ts`):**
- `brandTextProfile(b)` → struct camelCase pro `generate-content` (`{name, tone, targetAudience, industry, keywords, avoidWords, examplePosts, systemPrompt}`).
- `brandImageDirective(b)` → string injetada no prompt de imagem: paleta/tom/setor; instrui "não renderize texto nem logotipos" (a marca entra como overlay no canvas, não dentro da arte — salvo gpt-image-2 que embute texto no modo Automático).
- `brandTextHint(b)` → resumo curto pro system prompt do `ai-assist`.
- `brandSignature(b)` → handle/nome pra assinatura em carrossel/card.
- `normalizeBrand(...)`.

**Espelho no servidor:** `supabase/functions/_shared/brand.ts` (`brandToAIProfile`/`brandImageDirective`) — usado pelo `autopilot-run` para que a automação tenha a mesma marca-raiz que o Studio (antes divergia).

**Por onde atravessa:** Studio canvas (cores/overlay) · Copilot (brandTextHint→ai-assist) · generate-content (brandProfile completo) · openai-image/image-search (brandImageDirective) · Autopilot (config.brand_id → generate + visual).

## Camada de providers (`src/lib/api/*`, barrel `index.ts`)
Cada módulo embrulha uma edge function (ver skill `social-hub-edge-functions`). Padrão: chave do usuário em memória+localStorage, request roteada ao proxy.

| Módulo | Provider | Status | Funções-chave |
|--------|----------|--------|---------------|
| `postforme.ts` | **Post for Me (PFM)** | **CORE ATIVO** | `setPfmUserKey/getPfmUserKey`, `callPfm`, `pfmListAccounts`, `pfmCreatePost`, `pfmCreateUploadUrl`, `pfmPostResults`, `validatePfmKey`, `pfmAuthUrl` (login de redes). |
| `higgsfield.ts` | Higgsfield | Ativo | `callHiggsfield`, `hfTextToImage`, `hfTextToVideo`, `hfImageToVideo`, `hfStatus`, `hfCancel`. Catálogo em `src/lib/higgsfield-models.ts`. |
| `openai.ts` | OpenAI gpt-image-2 | Ativo | `generateOpenAiImage` (resolução de chave header→Vault→env). |
| `content.ts` | generate-content + stock-search + image-search | Ativo | `generateContent`, `searchStockImages` (Pexels), `searchImages` (Higgsfield Soul — órfão). |
| `firecrawl.ts` | Firecrawl | Ativo | search/scrape (research do Autopilot). |
| `sources.ts` | source-extract | Ativo | extrai+sumariza fonte. |
| `ai-assist.ts` | ai-assist | Ativo | helper genérico IA (reescrever/melhorar/sugerir). |
| `analytics.ts` | social-analytics (Apify) | Ativo | analytics de perfil. |
| `autopilot.ts` | autopilot-run/cron | Ativo | orquestra automação. |
| `_shared.ts` | — | — | utilitários comuns da camada. |

> **Blotato REMOVIDA (commit 32ae69f):** `src/lib/api/blotato.ts`, `src/hooks/use-blotato.ts` (hooks vivos migraram p/ `use-social.ts`), a edge function `blotato-proxy` e a coluna `user_configs.blotato_api_key` foram todas deletadas. Nenhum código ativo referencia mais a Blotato.

## Estado atual (pós-remoção da Blotato, commit 32ae69f)
`isConfigured = !!PFM`. Setup: **PFM é o passo obrigatório**. Login de redes 100% PFM; postagem 100% PFM; imagens 100% OpenAI gpt-image-2; vídeo 100% Higgsfield; acervo 100% Pexels; fontes 100% Firecrawl (`source-extract`). A Blotato não existe mais no app — todo o código, proxy, coluna e docs dedicados foram removidos.

## Erros & validação
- `src/lib/pfm-errors.ts` — mapeia erros da PFM.
- `validatePfmKey/validateHiggsFieldKey/validatePexelsKey/validateFirecrawlKey` testam chaves no Setup antes de salvar.

## Mapas de API (`docs/`)
`POSTFORME_API_MAP.md` + `postforme-openapi.json` (PFM), `STUDIO_IMPROVEMENTS.md` (benchmark + backlog P0/P1/P2). (Os docs `BLOTATO_API_MAP.md`/`blotato-api-reference.md` foram removidos junto com a Blotato.)
