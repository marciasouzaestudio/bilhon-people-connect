# Studio — Pesquisa & Backlog de Melhorias

> Documento vivo. Pesquisa de mercado (mai/2026) + análise do código para levar o Studio ao estado da arte.
> Status atual: Studio unificado com 5 abas (Imagem, Post, Carrossel[IA+Canvas], Vídeo[texto+imagem], Templates),
> marca como raiz em tudo, IA assistindo em cada passo, publicação direta no Post for Me. Telas antigas aposentadas.

## 1. Benchmark — o que o estado da arte oferece (2026)

| Ferramenta | O que se destaca | Já temos? |
|---|---|---|
| **Buffer AI Assistant** | ideação → rascunho → agendamento → analytics num fluxo; ajuste por plataforma | Parcial (geração + ajuste por rede + publish; falta calendário/ideação contínua) |
| **Hootsuite OwlyWriter** | gera caption/ideias/variações por plataforma | ✅ (PostStudio: gerar + Melhorar/Encurtar/+Hashtags/+Emojis) |
| **Canva Brand Kit + Magic Design** | consistência de marca automática; múltiplos layouts a partir de uma ideia | ✅ marca-raiz; ⚠️ falta "N variações de layout" no carrossel |
| **Later / Sprout** | melhor horário p/ postar, fila/calendário visual, primeira comentário | ❌ melhor horário; ❌ fila/calendário no Studio; ❌ primeiro comentário |
| **Sprout (analytics)** | sentiment + recomendação de conteúdo | Parcial (já há Analytics IA + Insights, mas desconectado do Studio) |

## 2. Best practices que valem virar feature (fonte: Sprout/Buffer/HeyOrca/Nextiva, 2026)

- **Melhor horário**: meio-dia–18h, ter/qua melhores; domingo pior. → sugerir horário no agendamento.
- **Cadência**: 3–5 posts/semana basta. → planejador semanal/fila.
- **Hashtags relevantes** (não genéricas) — já geramos; melhorar relevância por nicho da marca.
- **Alt text / legendas em vídeo**: autoplay é mudo; acessibilidade. → gerar alt text e legendas automáticas (a meta original pedia "legendas automáticas").
- **Primeiro comentário**: prática comum p/ hashtags/links sem poluir a legenda. → campo "primeiro comentário".
- **Conteúdo descobrível e autêntico** > volume.

## 3. Backlog priorizado

### P0 — alto impacto, baixo/médio esforço
1. **Legendas automáticas em vídeo (closed captions)** — a meta original pedia explicitamente. Gerar SRT/queimar legenda via serviço de transcrição (ex.: Whisper) sobre o vídeo do Higgsfield. *Esforço: M.*
2. **Alt text por IA** — botão "gerar alt text" nas imagens (aiAssist), enviado no publish (PFM `account_configurations`). *Esforço: S.*
3. **Primeiro comentário** — campo no PublishPanel; publicar como comment após o post (checar suporte PFM). *Esforço: S–M.*
4. **Sugestão de melhor horário** — ao agendar, sugerir slots (ter/qua 11h–18h) a partir do histórico de `analytics_snapshots`/PFM. *Esforço: M.*

### P1 — diferencial competitivo
5. **Planejador semanal / fila visual** dentro do Studio (3–5/semana), integrando com `/schedule` e Autopilot. *Esforço: M–L.*
6. **N variações de layout** no carrossel (estilo Magic Design) — gerar 2–3 composições e o usuário escolhe. *Esforço: M.*
7. **Thread real** (X/Threads/Bluesky) — encadear múltiplos posts (hoje publicamos 1). Depende de suporte de thread no PFM. *Esforço: M.*
8. **Reaproveitar imagem→post** — "usar no post" direto da aba Imagem/Templates (passar mídia pro PostStudio sem ir pela galeria). *Esforço: S.*

### P2 — refinamentos e portes de nicho (antigas telas)
9. **AI Story Video com voz/idioma** — expor seletor de voz + idioma no fluxo de vídeo do Higgsfield (já suporta áudio nativo pt-BR). *Esforço: M.*
10. **Post-produção (combine clips)** — juntar clipes + música + título (era do CreateVisual). Via serviço de edição de vídeo. *Esforço: M–L.*
11. **AI Selfie / Avatar / Product** — já acessíveis pela aba Templates genérica; criar atalhos com inputs dedicados. *Esforço: S–M.*
12. **Modo "fila" (next free slot)** no publish (era publishMode "queue"). *Esforço: S.*

## 4. Qualidade técnica
- **Chunk do Studio ~281kB** (inclui `html2canvas`). Lazy-load do canvas/html2canvas para reduzir o bundle inicial. *Esforço: S.*
- **Rotacionar a chave OpenAI** colada no chat (já no Vault; trocar por higiene).
- **Custos**: gpt-image-2 em alta qualidade é caro; cache/preview em baixa e "render final" em alta.
- **Testes E2E** (Playwright já existe) cobrindo o fluxo do Studio.

## Fontes
- [Zapier — 9 best AI social media management tools 2026](https://zapier.com/blog/best-ai-social-media-management/)
- [Buffer — AI social media content creation](https://buffer.com/resources/ai-social-media-content-creation/)
- [Sprout Social — AI tools / best practices](https://sproutsocial.com/insights/social-media-ai-tools/)
- [Sprout Social — Best times to post 2026](https://sproutsocial.com/insights/best-times-to-post-on-social-media/)
- [HeyOrca — posting frequency / specs 2026](https://www.heyorca.com/blog/social-media-posting-frequency-by-platform-2026)
- [Nextiva — 29 social media best practices 2026](https://www.nextiva.com/blog/social-media-best-practices.html)
