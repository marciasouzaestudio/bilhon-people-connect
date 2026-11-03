# Changelog — Social Hub

## 2026-10-29 — Banco de imagens: Pixabay no lugar do Pexels

- O Pexels pausou a emissão de chaves novas e o central nunca teve chave dele: a busca de acervo só funcionava para quem já tinha chave própria (10 de 66 clientes). Card ClickUp 17tr6jh5gqv.
- `stock-search` busca no Pixabay com a chave da plataforma (secret `PIXABAY_API_KEY`), guarda cada busca por 24 h em `media/stock/cache/` (regra do Pixabay) e mantém o mesmo formato de resposta: nenhuma tela precisa mudar.
- Nova `stock-image` (publicada como `social_stock-image`): a imagem escolhida é copiada para `media/stock/pixabay/<id>.jpg` na primeira vez e depois só redireciona, porque o Pixabay não deixa usar o link dele para sempre.
- A chave do Pexels salva pelo cliente deixou de passar por cima da plataforma: vira reserva se o Pixabay falhar e continua sendo testada na tela de Configurações.

## 2026-06-13 — Remoção completa da Blotato

- Removidos: camada `src/lib/api/blotato.ts`, hooks Blotato (vivos migrados p/ `src/hooks/use-social.ts`), edge function `blotato-proxy`, coluna `user_configs.blotato_api_key` (migration `20260613000001`), Step 6 do onboarding e docs dedicados.
- `autopilot-run`/`check_visuals` agora só polla Higgsfield (vídeo); imagem OpenAI é síncrona.
- Substitutos já existentes: contas/publicação → Post for Me; imagem → OpenAI gpt-image-2; vídeo → Higgsfield; fontes → Firecrawl (`source-extract`); acervo → Pexels.

## 2026-04-01 — Identidade Visual de Marca

- Colunas dedicadas em `brand_profiles`: handle, profile_photo_url, website, social_links, values
- Nova aba "Identidade" no editor de marcas
- Auto-preenchimento de identidade no Editor de Carrossel

## 2026-04-01 — Editor de Carrossel Canvas

- Editor visual estilo canvas com drag-and-drop
- Templates: Clean, Dark, Gradient, Photo+Overlay
- Geração de conteúdo por IA
- Exportação PNG e publicação multi-plataforma

## 2026-03-31 — Preparação para Remix

- Branding genérico (placeholders neutros)
- Isolamento total por usuário (RLS + localStorage prefixado)
- Documentação REMIX.md e checklist pós-remix

## 2026-03-30 — Analytics & Insights IA

- Dashboard com KPIs e barra de seguidores
- Insights estratégicos por IA com 4 abas
- Analytics por plataforma via Apify

## 2026-03-29 — Fundação

- Autenticação e onboarding (wizard 7 passos)
- Integração Blotato + Post for Me
- Criação de posts e visuais
- Galeria, fontes, marcas
- Testes E2E com Playwright
