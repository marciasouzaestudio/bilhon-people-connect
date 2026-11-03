# 🔄 Guia de Remix — Social Hub

Este projeto foi preparado para ser distribuído via **Remix** no Lovable. Após o remix, o novo projeto terá uma cópia completa do código, edge functions, migrações e fluxo de onboarding — tudo funcionando de forma independente.

---

## ✅ O que funciona automaticamente após o Remix

| Componente | Status | Detalhes |
|---|---|---|
| **Frontend completo** | ✅ Automático | React + Tailwind + shadcn/ui |
| **Banco de dados** | ✅ Automático | Migrações aplicadas automaticamente no novo projeto |
| **Autenticação** | ✅ Automático | Login/signup com email + senha via Lovable Cloud |
| **RLS (Row Level Security)** | ✅ Automático | Cada usuário vê apenas seus dados |
| **Edge Functions** | ✅ Automático | Todas as funções são deployadas automaticamente |
| **IA (geração de conteúdo, insights, marca)** | ✅ Automático | Usa `LOVABLE_API_KEY` fornecida pelo Lovable Cloud |
| **Fluxo de onboarding** | ✅ Automático | Coleta chaves do usuário no `/setup` |
| **Isolamento por usuário** | ✅ Automático | API keys, dados, analytics — tudo por user_id |

---

## 🔑 Chaves de API — Como funciona

O sistema é **multi-tenant por design**. Cada usuário fornece suas próprias chaves no fluxo de Setup:

| Serviço | Obrigatório | Onde obter | Usado para |
|---|---|---|---|
| **Post for Me** | ✅ Sim | [app.postforme.dev/settings](https://app.postforme.dev/settings) | Publicação multi-plataforma + gestão de contas |
| **Higgsfield** | Opcional | [higgsfield.ai](https://higgsfield.ai) | Geração de vídeos IA |
| **Apify** | Opcional | [console.apify.com](https://console.apify.com) | Analytics reais (Instagram, TikTok, etc.) |
| **Firecrawl** | Opcional | [firecrawl.dev](https://firecrawl.dev) | Pesquisa web e extração de fontes (Autopilot) |
| **Pexels** | Opcional | [pexels.com/api](https://www.pexels.com/api/) | Banco de imagens (fotos de acervo) |

> **Imagens por IA** são geradas via OpenAI gpt-image-2 (chave de plataforma no Vault — sem configuração do usuário).

> **Nota:** A chave `LOVABLE_API_KEY` é fornecida automaticamente pelo Lovable Cloud e não precisa de configuração manual. Ela alimenta as funcionalidades de IA (geração de conteúdo, insights estratégicos, sugestão de marca).

---

## 🏗️ Arquitetura do Projeto

```
src/
├── pages/           # Páginas da aplicação
├── components/      # Componentes reutilizáveis
├── contexts/        # AppContext (config) + AuthContext (auth)
├── hooks/           # Custom hooks (use-social, theme, etc.)
├── lib/             # API, storage, utils
└── integrations/    # Supabase client (auto-gerado)

supabase/
├── functions/       # Edge Functions
│   ├── postforme-proxy/     # Proxy Post for Me API (contas/publicação)
│   ├── generate-content/    # Geração de conteúdo IA
│   ├── openai-image/        # Geração de imagem (gpt-image-2)
│   ├── brand-suggest/       # Sugestão de marca IA
│   ├── analytics-insights/  # Insights estratégicos IA
│   ├── social-analytics/    # Analytics via Apify
│   ├── higgsfield-proxy/    # Proxy Higgsfield (vídeo)
│   ├── firecrawl-search/    # Pesquisa web (Autopilot)
│   ├── source-extract/      # Extração de fontes (Firecrawl + IA)
│   ├── stock-search/        # Banco de imagens (Pexels)
│   └── autopilot-run/       # Pipeline de automação
└── migrations/      # Schema do banco de dados
```

---

## 📊 Tabelas do Banco

| Tabela | Propósito |
|---|---|
| `user_configs` | Chaves de API e configuração por usuário |
| `brand_profiles` | Perfis de marca (tom, público, cores, logo) |
| `creations` | Galeria de visuais criados |
| `post_history` | Histórico de publicações |
| `saved_sources` | Fontes de conteúdo extraídas |
| `analytics_snapshots` | Snapshots de analytics das redes |

Todas as tabelas possuem **RLS** ativo com políticas `auth.uid() = user_id`.

---

## 🚀 Fluxo do Usuário após Remix

1. **Signup/Login** → Cria conta no novo projeto
2. **Setup (/setup)** → Wizard de 7 passos para configurar chaves de API
3. **Dashboard** → Visão geral com métricas, analytics e atalhos
4. **Uso normal** → Criar posts, visuais, agendar, analytics, brands

---

## ⚠️ O que NÃO é transferido no Remix

- **Dados de usuários** — Cada projeto começa com banco limpo
- **Secrets do projeto** (HIGGSFIELD_API_ID, APIFY_API_TOKEN, etc.) — Não são necessários pois cada usuário fornece os seus via Setup
- **Domínio customizado** — Precisa publicar e configurar novo domínio

---

## 🎨 Personalização

Para personalizar a marca do app (não das marcas dos usuários):

- **Nome do app**: Altere em `src/components/layout/AppSidebar.tsx` e `src/pages/Login.tsx`
- **Cores**: Edite `src/index.css` (variáveis CSS) e `tailwind.config.ts`
- **Logo**: Substitua o ícone em `AppSidebar.tsx`

---

## 📝 Notas Técnicas

- **localStorage** usa prefixo `app_u:<userId>:` para isolamento entre usuários
- **Edge Functions** priorizam chaves dos headers (fornecidas pelo usuário) sobre variáveis de ambiente
- **Lovable AI Gateway** é usado para IA (sem necessidade de chave OpenAI/Google separada)
- O projeto suporta **dark mode** nativamente
