---
name: social-hub-edge-functions
description: As 15 edge functions Deno do Social Hub / start-clean-bloom (supabase/functions/*) — o que cada uma faz, qual API externa proxia, de onde tira a chave, e quais estão ativas vs órfãs/inertes. Use ao mexer em backend, adicionar integração ou planejar o que cortar no pivô.
---

# Social Hub — Edge Functions

Todas em Deno (`supabase/functions/<nome>/index.ts`). `config.toml` só declara `project_id` — não há verify_jwt por-função; os proxies são chamados pelo client autenticado e recebem a **chave do usuário no header** (ex.: `x-pfm-api-key`, `x-higgsfield-api-id:secret`, `x-firecrawl-api-key`, `x-pexels-api-key`, `x-apify-api-token`, `x-openai-api-key`). As que usam IA própria leem `LOVABLE_API_KEY` do env (gateway Lovable, modelo Gemini). A camada `src/lib/api/*` é quem chama essas functions.

## Ativas — núcleo
| Função | API externa | Chave | Papel |
|--------|-------------|-------|-------|
| **postforme-proxy** | Post for Me (`api.postforme.dev/v1`) | header `x-pfm-api-key` | **CORE.** Contas, postagem, agendamento, analytics, upload de mídia. Substituiu a Blotato em tudo de conta/post. |
| **generate-content** | Lovable AI Gateway (Gemini) | env `LOVABLE_API_KEY` | Geração de texto: recebe prompt+platforms+brandProfile → `posts{}`, `carousel`, `hashtags[]`, `imageKeywords[]`. |
| **openai-image** | OpenAI gpt-image-2 | header `x-openai-api-key` → Vault `OPENAI_API_KEY` → env | Geração de imagem. Resolve chave: header > Vault (get_vault_secret) > env. (quality high→medium, limite ~150s edge.) |
| **higgsfield-proxy** | Higgsfield (`platform.higgsfield.ai`) | header `x-higgsfield-api-id:secret` | Text-to-video (Kling 2.6/Sora 2/Veo 3), image-to-video, status polling, cancel. Áudio nativo pt-BR. |
| **ai-assist** | Lovable AI Gateway (Gemini) | env `LOVABLE_API_KEY` | Helper genérico de IA: melhorar prompt, sugerir direções, reescrever legenda. Usado em todo o Copilot do Studio. |

## Ativas — suporte
| Função | API externa | Chave | Papel |
|--------|-------------|-------|-------|
| **brand-suggest** | Lovable AI Gateway | env | Autopreenche campos de marca (tom/keywords/system_prompt) a partir de nome+descrição. |
| **stock-search** | Pexels | header `x-pexels-api-key` | Busca fotos reais (acervo). Normaliza `{id,url,thumbUrl,fullUrl,alt,author,...}`. **É Pexels, não Unsplash.** |
| **firecrawl-search** | Firecrawl (`/v1/search`) | header `x-firecrawl-api-key` | Busca+scrape web (markdown ~2000 char/result). Usado pela pesquisa do Autopilot. 402 (sem crédito) → retorna `{fallback:true, results:[]}`. |
| **source-extract** | Firecrawl scrape + Lovable AI | header/raw | Extrai+sumariza conteúdo: URL→Firecrawl→IA, ou texto cru→IA. Síncrono. Usado na tela Sources. |
| **social-analytics** | Apify Actors | header `x-apify-api-token` | Scrapers de perfil (IG/Twitter/TikTok/YouTube/FB/Threads/LinkedIn/Pinterest) + enriquecimento opcional. |
| **analytics-insights** | Lovable AI Gateway | env | Analisa métricas → insights em pt-BR. |

## Automação (service role — ver skill `social-hub-autopilot`)
| Função | Papel |
|--------|-------|
| **autopilot-cron** | Job periódico: dispara generate/curate/schedule/check_visuals/confirm nas configs/calendars vencidas. |
| **autopilot-run** | Pipeline principal: research(Firecrawl) → generate-content → visuais(openai-image/higgsfield) → schedule → confirm(PFM). Usa `_shared/brand.ts`. |

## `_shared/`
`_shared/brand.ts` — helpers de marca pro lado servidor (`brandToAIProfile`/`brandImageDirective`); espelha `src/lib/brand.ts`. `deno.json` na raiz de functions.

## Removidas / órfãs
- **blotato-proxy** — **REMOVIDA (commit 32ae69f).** A Blotato foi totalmente excluída do app (proxy, camada API, hooks, coluna). Substitutos: contas/post=PFM, imagem=OpenAI, vídeo=Higgsfield, fontes=Firecrawl.
- **image-search** — Higgsfield Soul (text-to-image), fallback placeholder. **Órfã** desde que o "Banco de imagens" migrou pra Pexels (`stock-search`, commit ae64b8f). Deployada, inofensiva, não usada (não é Blotato — candidata separada a remoção).

## Riscos conhecidos
- Polling de vídeo Higgsfield no Copilot para após ~2min; vídeo mais longo deixa estado preso em "generating" sem erro explícito.
- Autopilot sem rollback: se `autopilot-run` falha no meio (visual falha), calendário pode ficar travado em `scheduling` sem retry de UI.
- `check_visuals` do autopilot-run agora trata só `higgsfield` (assíncrono); qualquer `visual_provider != 'higgsfield'` é skip (resíduo legado). Imagem OpenAI é síncrona.
