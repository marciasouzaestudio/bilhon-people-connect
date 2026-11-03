---
name: social-hub-studio
description: O Studio — feature núcleo do Social Hub / start-clean-bloom (rota /studio). Cobre os 2 modos (Automático IA / Assistido canvas), o modelo de documento (StudioDoc/Slide/El), o fluxo de geração e o fluxo de publicação via PFM. Use ao mexer em criação de conteúdo, canvas, geração de imagem/vídeo ou publicação.
---

# Social Hub — Studio (criação de conteúdo)

Rota `/studio` (`src/pages/Studio.tsx`, full-bleed, cancela padding do AppLayout). Unificou as telas antigas (/create, /carousel, /visuals → redirect). Consome `location.state` para deep-links (sourceContent/prompt→briefing, mediaUrls→mídia, scheduleAt→agendar). Cobre **post · carrossel · imagem · vídeo · card** num só lugar.

## Entrada e 2 modos (`src/components/studio/workspace/`)
`Studio.tsx` abre `StudioEntry.tsx` (escolhe o modo):
- **(a) Automático** (`AutoStudio.tsx`): usuário dá **1 prompt** → `aiAssist` interpreta o brief (format/count/topic/objective em JSON) → `generate-content` (texto) + `gpt-image-2` gera a **arte de cada slide com texto embutido** (gpt-image-2 escreve texto bem) → preview + publicação (`OutputScreen`/PublishPanel) + botão "Refinar no canvas" (handoff pro Assistido). Vídeo via Higgsfield.
- **(b) Assistido** (`StudioWorkspace.tsx`): editor de canvas estilo Canva/Claude-Design. Deep-links (location.state) caem direto aqui. Tem `onBack`.

## Modelo de documento (`workspace/types.ts`)
```
StudioDoc { format, brandId, slides[], videoUrl?, caption, captionsByPlatform?, hashtags[], platforms[], schedule{when,at?} }
Slide     { bg, bgImage?, els[] }   // 1 slide p/ image/post; N p/ carrossel
El        { id, type:'text'|'image'|'shape', x,y,w,h, ...(text|image|shape props) }
```
Canvas **4:5 (1080×1350, padrão Instagram 2026)**. Preview 360×450 (escala 3× no export). `gpt-image-2` gera em `1024x1536` (2:3, mais próximo de 4:5). O 4:5 substituiu o formato quadrado obsoleto (commit e87f589).

## Peças do workspace
- **StudioProvider.tsx** — estado via reducer + undo/redo (histórico ~50 passos). Fonte da verdade do StudioDoc.
- **DesignCanvas.tsx** — render dos slides, drag/drop de elementos, inspector inline, fundo (cor/gradiente/IA), registra o **exporter** (html2canvas → data URLs). Overlay de logo/handle só quando sem `bgImage` e `format != card` (evita marca dupla em arte gerada por IA).
- **Copilot.tsx** — guia-de-prompt + geração orquestrada por formato: "Melhorar ideia", "Sugerir direções", gerar visual (OpenAI gpt-image-2 ou Higgsfield), busca de imagem (Pexels stock ou IA). Inclui seletor de plataformas (corrige regressão de texto por-rede). Passa marca via `brandTextHint()` ao ai-assist.
- **ElementInspector.tsx** — edição do elemento selecionado.
- **AssetsRail.tsx** — upload + Pexels (acervo) + **ArtStyles** (8 estilos gpt-image-2 marca-aware). Integra galeria.
- **FlowBar.tsx** — barra de fluxo/ações.
- **PublishDrawer.tsx** → reusa **`src/components/studio/PublishPanel.tsx`**.
- **OutputScreen.tsx** — tela de resultado: carrossel de slides, edição de legenda (com IA), seleção de plataforma/conta, agendar/agora.

## Fluxo de geração
1. Intenção/prompt no Copilot (ou brief no Automático).
2. Contexto de marca: `brandTextProfile()` + `brandImageDirective()` (`src/lib/brand.ts`) — ver skill `social-hub-brand-and-providers`.
3. Texto: `generate-content` → posts por plataforma, slides de carrossel, hashtags, imageKeywords.
4. Visual: imagem por IA (`openai-image` gpt-image-2) ou acervo (`stock-search` Pexels) ou vídeo (`higgsfield-proxy`, com polling `hfStatus`).
5. Export: `DesignCanvas` → html2canvas → PNG data URLs (sobem pro bucket `media`).
6. Auto-save na galeria (`creations`) em todos os pontos de geração.

## Fluxo de publicação (100% PFM — Post for Me)
`PublishPanel.tsx` (reutilizável, ligado em Post/Imagem/Vídeo/Canvas):
- `usePfmAccounts` lista contas conectadas (login de redes 100% PFM via `pfmAuthUrl`).
- `pfmCreateUploadUrl` faz upload de mídia (data: ou http) → `pfmCreatePost` com `account_configurations` (suporta IG placement Feed/Reels/Stories), agendar ou agora → `markAsPublishedByUrls`.
- Legenda automática por IA por rede; primeiro comentário/alt text/closed captions são P0 pendentes (ver `docs/STUDIO_IMPROVEMENTS.md`).

## Notas
- Bundle do Studio ~282kB; html2canvas é lazy.
- `gpt-image-2` está em constante única no proxy — se a API recusar, trocar p/ `gpt-image-1`.
- Componentes antigos (ImageStudio/PostStudio/CarouselStudio/CarouselWorkspace/VideoStudio) foram **removidos**; tudo passa pelo workspace unificado.
