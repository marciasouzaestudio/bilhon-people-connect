---
name: social-hub-creatives
description: O módulo CRIATIVOS (Meta Ads) do Social Hub — rota /criativos, separado do Studio de posts. Cobre o "offer canvas" (abstração do produto/oferta), como a marca-raiz vira guia de branding/voz, as 3 tabelas app_social (creative_offers/creative_sets/creatives), as 2 edge functions (social_creative-generate, social_creative-image) e o motor de geração (ângulos × formatos com fotos do produto e logo como referência). Use ao mexer em anúncios, criativos, ofertas ou geração de arte para Meta.
---

# Social Hub — Criativos (Meta Ads)

Rota `/criativos` (`src/pages/Creatives.tsx`, grupo "Criar" do menu). Módulo **separado do Studio**: o Studio faz post/carrossel para publicar via PFM; aqui saem **anúncios** (copy + arte) para subir no Gerenciador de Anúncios da Meta. Nada é publicado automaticamente.

## Conceito: oferta → conjunto → peças
1. **Oferta** (`creative_offers`) — o "offer canvas": abstração do produto/oferta que a IA consome. Nome, tipo, o que é, promessa, público, dores, benefícios, diferenciais, objeções, provas sociais, preço, mecanismo (desconto/bônus/garantia/escassez/frete/trial/parcelamento), detalhes, prazo, garantia, CTA da Meta, URL de destino, **fotos do produto** (bucket `media`), URL da página de vendas. `OfferDialog.tsx` tem "Preencher com IA": Firecrawl (`source-extract`) lê a página → `social_creative-generate` modo `offer_from_context` estrutura os campos; `mergeOfferFromAI` só substitui o que a IA trouxe preenchido.
2. **Conjunto** (`creative_sets`) — 1 oferta + 1 marca + objetivo (conversao|leads|trafego|reconhecimento|mensagens|engajamento) + formatos + opções da arte + `plan` (JSON dos ângulos que a IA propôs). Status planning|generating|done|failed.
3. **Peças** (`creatives`) — 1 linha por ângulo × formato: headline, primary_text, description, cta_type, text_overlay, image_url, image_prompt, status draft|approved|rejected, `metadata` (alt_headlines, rationale, image_mode, error).

## Marca como guia de branding e voz
`brandForCreatives(b)` (= `brandTextProfile` + paleta + valores) vai ao `social_creative-generate` para copy. `brandAdDirective(b)` (em `src/lib/creatives.ts`) entra no prompt de imagem — **diferente da `brandImageDirective` do Studio**, aqui texto e logo são bem-vindos. Se a marca tem `logo_url`, o logo real vai como **imagem de referência** e a arte sai assinada; as fotos do produto idem (até 4 referências no total, `pickReferences`).

## Fluxo (`CreativeWizard.tsx`)
1. Configurar: oferta, marca (default = marca da oferta), objetivo, nº de ângulos (2–6), formatos (`feed_1x1` 1080², `feed_4x5` 1080×1350, `story_9x16` 1080×1920), opções (`textOnArt`, `useProductPhotos`, `includeLogo`, `style`, `extraDirection`).
2. Planejar: `creativePlan()` → ângulos com hook_type distinto (dor, benefício, prova social, oferta, curiosidade, objeção, autoridade, urgência, comparação, história), copy dentro dos limites da Meta (40/125/30) e brief visual (scene, composition, text_overlay, style). Usuário edita/desliga ângulos; "Outros ângulos" repete excluindo os nomes atuais.
3. Gerar: `generateCreativeSet()` (`src/lib/creative-engine.ts`) cria o set e roda ângulos × formatos com concorrência 3: `buildImagePrompt` → `social_creative-image` (tamanho gpt-image mais próximo) → `fitImageToAspect(cover)` para a proporção da Meta → upload `media/{uid}/criativos/{setId}/` → insert em `creatives` + espelho em `creations` (Galeria, template "Criativos · <oferta>"). Falha individual vira peça sem imagem com `metadata.error` (regenerável no card).

`CreativeSetView.tsx`: peças por ângulo, filtro por formato/aprovados, editar copy inline (`useUpdateCreative` otimista), aprovar/rejeitar, copiar copy, baixar arte, regenerar arte (`regenerateCreativeImage`), "Refinar no Studio" (deep-link `/studio` com mediaUrls), exportar CSV (`creativesToCsv`) e baixar todas.

## Backend (central `auytmefqnuzbktyzcled`, schema `app_social`)
- DDL em `supabase/migrations-central/20260916000001_app_social_creatives.sql` (aplicada via MCP `apply_migration`). Padrão canônico: `org_id` + `user_id`, RLS 4 policies (`core.is_org_member` / `user_id = auth.uid()`), triggers `app_social.fill_org_id` + `core.set_updated_at`. FKs internas: sets→offers (cascade), creatives→sets/offers (cascade), brand_id→brand_profiles (set null).
- **`social_creative-generate`** (`supabase/functions/creative-generate/`): Gemini (`GEMINI_API_KEY`, gemini-3.5-flash, `response_format json_object`, max_tokens 8192). Modos `offer_from_context` e `plan`. verify_jwt=true + getUser + rate-limit 20/min por usuário.
- **`social_creative-image`** (`supabase/functions/creative-image/`): clone endurecido do `social_openai-image` (cota `openai_image` por org via `reserve_ai_quota`/`release_ai_quota`/`record_ai_generation`, chave OpenAI do Vault) + `referenceImages[]` → quando presentes usa `/v1/images/edits` multipart (produto/logo reais). Rate-limit 20/min. **Isolada de propósito** para não tocar o caminho de produção dos posts.
- Deploy: MCP `deploy_edge_function` com `name=social_<slug>` e arquivo `<slug>/index.ts` (o Lovable NÃO publica `supabase/functions/`).
- Tipos das tabelas adicionados à mão em `src/integrations/supabase/types.ts` (o arquivo é "gerado", mas o gerador não roda aqui).

## Arquivos
`src/lib/meta-creative-specs.ts` (formatos, limites, CTAs, objetivos, hooks, estilos) · `src/lib/creatives.ts` (tipos, conversões, prompt de imagem, CSV, CRUD) · `src/lib/creative-engine.ts` (geração em lote/regeneração) · `src/lib/api/creatives.ts` (cliente das 2 functions) · `src/hooks/use-creatives.ts` · `src/components/creatives/{OfferDialog,CreativeWizard,CreativeSetView,CreativeCard,ListInput}.tsx` · testes `src/lib/creatives.test.ts`, `src/lib/meta-creative-specs.test.ts`.

## Cuidados
- Um conjunto de 4 ângulos × 3 formatos = **12 imagens** contra a cota default da org (30/dia, 100/mês). O wizard mostra a conta antes de gerar.
- `/images/edits` com referência: se a OpenAI recusar o modelo no edits, a função devolve a mensagem da API; fallback é desligar "Usar fotos do produto"/"Aplicar o logo" no wizard.
- Copies acima do recomendado ficam em amarelo (long) e vermelho (over) no wizard e no card; a Meta aceita mas corta na exibição.
