import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Zernio API Proxy
 *
 * Proxy unificado para todas as operações do Zernio (publicação multi-plataforma):
 * - Conexão de contas (OAuth)
 * - Postagem & agendamento
 * - Analytics & métricas
 * - Upload de mídia
 *
 * Substitui o antigo postforme-proxy. A chave de API do Zernio chega por
 * requisição (body.apiKey ou header x-zernio-api-key) ou via env ZERNIO_API_KEY.
 *
 * Autenticação: as sessões dos usuários vivem no backend de contas original
 * (externo), então o token é validado contra o endpoint de auth desse backend.
 */

const ZERNIO_BASE = "https://zernio.com/api";

// Backend de contas original (onde vivem as sessões dos usuários)
const ACCOUNTS_AUTH_URL = "https://auytmefqnuzbktyzcled.supabase.co";
const ACCOUNTS_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1eXRtZWZxbnV6Ymt0eXpjbGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTc4MjYsImV4cCI6MjA5ODIzMzgyNn0.zIRr-xM3Z_nM3xkOKWp6J3uCRVi_fWeiGvxZlOh7Rok";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zernio-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
type Args = Record<string, any>;

interface RouteConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: (args: Args) => string;
  body?: (args: Args) => unknown;
  query?: (args: Args) => string;
}

function isValidMediaUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value !== "undefined"
    && !value.startsWith("blob:");
}

function guessMediaType(url: string): string {
  if (/\.(mp4|mov|webm|avi|mkv)(\?|#|$)/i.test(url)) return "video";
  if (/\.gif(\?|#|$)/i.test(url)) return "gif";
  if (/\.(pdf|doc|docx|ppt|pptx)(\?|#|$)/i.test(url)) return "document";
  return "image";
}

function normalizeMediaItem(value: unknown): Record<string, unknown> | null {
  if (isValidMediaUrl(value)) {
    return { url: value, type: guessMediaType(value) };
  }
  if (value && typeof value === "object") {
    const media = value as { url?: unknown; type?: unknown } & Record<string, unknown>;
    if (isValidMediaUrl(media.url)) {
      return {
        ...media,
        url: media.url,
        type: typeof media.type === "string" ? media.type : guessMediaType(media.url),
      };
    }
  }
  return null;
}

function normalizeMediaList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeMediaItem)
    .filter((item): item is Record<string, unknown> => item !== null);
}

/** Mapeia nomes de plataforma legados para os nomes do Zernio. */
function zernioPlatform(platform: unknown): string {
  const p = String(platform || "").toLowerCase();
  if (p === "x") return "twitter";
  return p;
}

async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  // service_role do backend de contas (para chamadas servidor-a-servidor)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) return true;

  // Valida o JWT do usuário contra o backend de contas original
  try {
    const res = await fetch(`${ACCOUNTS_AUTH_URL}/auth/v1/user`, {
      headers: { apikey: ACCOUNTS_ANON_KEY, Authorization: authHeader },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Busca o primeiro profile do Zernio (necessário para conectar contas). */
async function getDefaultProfileId(apiKey: string): Promise<string | null> {
  const res = await fetch(`${ZERNIO_BASE}/v1/profiles?limit=1`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data?.data || data?.profiles || (Array.isArray(data) ? data : []);
  return items[0]?.id || items[0]?._id || null;
}

const ROUTES: Record<string, RouteConfig> = {
  // ── Contas ──────────────────────────────────────────
  pfm_auth_url: {
    method: "GET",
    path: (a) => `/v1/connect/${zernioPlatform(a.platform)}`,
    query: (a) => {
      const params = new URLSearchParams();
      // profileId é injetado no handler (requer chamada extra)
      if (a.__profileId) params.set("profileId", String(a.__profileId));
      if (a.redirect_url_override) params.set("redirect_url", a.redirect_url_override);
      if (a.redirect_url) params.set("redirect_url", a.redirect_url);
      return params.toString();
    },
  },
  pfm_list_accounts: {
    method: "GET",
    path: () => "/v1/accounts",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.platform) params.set("platform", zernioPlatform(a.platform));
      if (a.status) params.set("status", a.status);
      params.set("limit", "500");
      return params.toString();
    },
  },
  pfm_get_account: {
    method: "GET",
    path: (a) => `/v1/accounts/${a.id}`,
  },
  pfm_disconnect_account: {
    method: "DELETE",
    path: (a) => `/v1/accounts/${a.id}`,
  },

  // ── Posts ──────────────────────────────────────────────
  pfm_create_post: {
    method: "POST",
    path: () => "/v1/posts",
    body: (a) => {
      const accounts: string[] = Array.isArray(a.social_accounts) ? a.social_accounts : [];
      const media = normalizeMediaList(a.media);

      // account_configurations (PFM) → platforms[] com customContent/customMedia (Zernio)
      const accConfigs: Args[] = Array.isArray(a.account_configurations) ? a.account_configurations : [];

      const platforms = accounts.map((accountId) => {
        const cfg = accConfigs.find((c) => c?.social_account_id === accountId)?.configuration;
        const target: Args = { platform: "instagram", accountId };
        // platform real é resolvida no handler via mapa accountId→platform
        if (a.scheduled_at) target.scheduledFor = a.scheduled_at;
        if (cfg && typeof cfg === "object") {
          const { media: cfgMedia, ...rest } = cfg as Args;
          if (rest.caption || rest.text) target.customContent = rest.caption || rest.text;
          const customMedia = normalizeMediaList(cfgMedia);
          if (customMedia.length > 0) target.customMedia = customMedia;
          // demais opções específicas da plataforma
          const { caption: _c, text: _t, ...platformSpecific } = rest;
          if (Object.keys(platformSpecific).length > 0) {
            target.platformSpecificData = platformSpecific;
          }
        }
        return target;
      });

      const post: Args = {
        content: a.caption || a.text || "",
        platforms,
      };
      if (media.length > 0) post.mediaItems = media;
      if (a.isDraft) post.status = "draft";
      return post;
    },
  },
  pfm_list_posts: {
    method: "GET",
    path: () => "/v1/posts",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.platform) params.set("platform", zernioPlatform(a.platform));
      if (a.status) params.set("status", a.status);
      if (a.limit) params.set("limit", String(a.limit));
      if (a.offset) params.set("offset", String(a.offset));
      return params.toString();
    },
  },
  pfm_get_post: {
    method: "GET",
    path: (a) => `/v1/posts/${a.id}`,
  },
  pfm_update_post: {
    method: "PUT",
    path: (a) => `/v1/posts/${a.id}`,
    body: (a) => a.data,
  },
  pfm_delete_post: {
    method: "DELETE",
    path: (a) => `/v1/posts/${a.id}`,
  },

  // ── Analytics ─────────────────────────────────────────
  pfm_post_results: {
    method: "GET",
    path: () => "/v1/analytics",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.social_account_id) params.set("accountId", a.social_account_id);
      if (a.platform) params.set("platform", zernioPlatform(a.platform));
      if (a.post_id) params.set("postId", a.post_id);
      if (a.limit) params.set("limit", String(a.limit));
      return params.toString();
    },
  },
  pfm_get_post_result: {
    method: "GET",
    path: () => "/v1/analytics",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.id) params.set("postId", a.id);
      return params.toString();
    },
  },
  pfm_account_feed: {
    method: "GET",
    path: () => "/v1/analytics",
    query: (a) => {
      const params = new URLSearchParams();
      params.set("accountId", a.social_account_id);
      if (a.limit) params.set("limit", String(a.limit));
      if (a.cursor) params.set("cursor", a.cursor);
      return params.toString();
    },
  },

  // ── Mídia ─────────────────────────────────────────────
  pfm_upload_url: {
    method: "POST",
    path: () => "/v1/media/presign",
    body: (a) => ({
      filename: a.filename || `upload-${Date.now()}.bin`,
      contentType: a.contentType || "application/octet-stream",
      ...(a.size ? { size: a.size } : {}),
    }),
  },

  // ── Webhooks ──────────────────────────────────────────
  pfm_create_webhook: {
    method: "POST",
    path: () => "/v1/webhooks/settings",
    body: (a) => a.data,
  },
  pfm_list_webhooks: {
    method: "GET",
    path: () => "/v1/webhooks/settings",
  },
  pfm_delete_webhook: {
    method: "DELETE",
    path: () => "/v1/webhooks/settings",
    body: (a) => a.data,
  },
};

// ─── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!(await isAuthorized(req))) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tool, args = {}, apiKey: bodyApiKey } = (await req.json()) as {
      tool: string;
      args?: Args;
      apiKey?: unknown;
    };

    // API key do body, header legado ou env
    const apiKey =
      (typeof bodyApiKey === "string" && bodyApiKey.trim() ? bodyApiKey.trim() : undefined) ||
      req.headers.get("x-zernio-api-key") ||
      Deno.env.get("ZERNIO_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ZERNIO_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tool) {
      return new Response(
        JSON.stringify({ error: "Missing 'tool'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = ROUTES[tool];
    if (!route) {
      return new Response(
        JSON.stringify({ error: `Unknown tool: ${tool}`, available: Object.keys(ROUTES) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Conectar conta exige um profileId do Zernio — resolve automaticamente
    if (tool === "pfm_auth_url") {
      const profileId = await getDefaultProfileId(apiKey);
      if (!profileId) {
        return new Response(
          JSON.stringify({
            error: "Nenhum perfil encontrado na sua conta Zernio. Crie um perfil no painel do Zernio antes de conectar redes.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      args.__profileId = profileId;
    }

    // Para criar posts, resolve a plataforma real de cada conta
    if (tool === "pfm_create_post" && Array.isArray(args.social_accounts) && args.social_accounts.length > 0) {
      try {
        const accRes = await fetch(`${ZERNIO_BASE}/v1/accounts?limit=500`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (accRes.ok) {
          const accData = await accRes.json();
          const list = accData?.data || accData?.accounts || (Array.isArray(accData) ? accData : []);
          const platformById = new Map<string, string>();
          for (const acc of list) {
            const id = acc?.id || acc?._id;
            if (id && acc?.platform) platformById.set(String(id), zernioPlatform(acc.platform));
          }
          args.__platformById = Object.fromEntries(platformById);
        }
      } catch { /* segue com fallback */ }
    }

    const queryStr = route.query ? route.query(args) : "";
    const url = `${ZERNIO_BASE}${route.path(args)}${queryStr ? `?${queryStr}` : ""}`;

    let body = route.body ? route.body(args) : undefined;

    // Aplica o mapa accountId→platform nos targets do post
    if (tool === "pfm_create_post" && body && typeof body === "object" && args.__platformById) {
      const map = args.__platformById as Record<string, string>;
      const b = body as Args;
      if (Array.isArray(b.platforms)) {
        b.platforms = b.platforms.map((t: Args) => ({
          ...t,
          platform: map[String(t.accountId)] || t.platform,
        }));
      }
    }

    const fetchOptions: RequestInit = {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    };

    if (body && (route.method === "POST" || route.method === "PUT" || route.method === "PATCH")) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.message || data.error || `Zernio API ${response.status}`, details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normaliza respostas para o formato que o app espera (compatível com PFM)
    if (tool === "pfm_auth_url") {
      return new Response(JSON.stringify({ url: data.authUrl || data.url || "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tool === "pfm_upload_url") {
      return new Response(
        JSON.stringify({
          data: { media_url: data.publicUrl, upload_url: data.uploadUrl },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("zernio-proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
