import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Post for Me API Proxy
 *
 * Unified proxy for all Post for Me operations:
 * - Account connection (OAuth)
 * - Posting & scheduling
 * - Analytics & metrics
 * - Media upload
 * - Feed reading
 *
 * Core de contas/publicação/agendamento. Analytics complementar via Apify.
 */

const PFM_BASE = "https://api.postforme.dev/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pfm-api-key",
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

function normalizeMediaItem(value: unknown): Record<string, unknown> | null {
  if (isValidMediaUrl(value)) {
    return { url: value };
  }

  if (value && typeof value === "object") {
    const media = value as { url?: unknown } & Record<string, unknown>;
    if (isValidMediaUrl(media.url)) {
      return { ...media, url: media.url };
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

function normalizeAccountConfigurations(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((item) => {
    if (!item || typeof item !== "object") return item;

    const configItem = item as {
      configuration?: Record<string, unknown>;
    } & Record<string, unknown>;

    if (!configItem.configuration || typeof configItem.configuration !== "object") {
      return configItem;
    }

    const configuration = { ...configItem.configuration };
    const media = normalizeMediaList(configuration.media);

    if (media.length > 0) {
      configuration.media = media;
    } else {
      delete configuration.media;
    }

    return { ...configItem, configuration };
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) return true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return false;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const ROUTES: Record<string, RouteConfig> = {
  // ── Accounts ──────────────────────────────────────────
  pfm_auth_url: {
    method: "POST",
    path: () => "/social-accounts/auth-url",
    body: (a) => {
      const permissions = Array.isArray(a.permissions) && a.permissions.length > 0
        ? a.permissions
        : ["posts", "feeds"];

      const data: Args = {
        platform: a.platform,
        permissions,
      };
      // Platform-specific data
      if (a.platform === "instagram") {
        data.platform_data = { instagram: { connection_type: a.connection_type || "instagram" } };
      } else if (a.platform === "linkedin") {
        data.platform_data = { linkedin: { connection_type: a.connection_type || "personal" } };
      } else if (a.platform === "bluesky" && a.handle) {
        data.platform_data = { bluesky: { handle: a.handle, app_password: a.app_password } };
      }
      if (a.external_id) data.external_id = a.external_id;
      if (a.redirect_url_override) data.redirect_url_override = a.redirect_url_override;
      return data;
    },
  },
  pfm_list_accounts: {
    method: "GET",
    path: () => "/social-accounts",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.platform) params.set("platform", a.platform);
      if (a.status) params.set("status", a.status);
      return params.toString();
    },
  },
  pfm_get_account: {
    method: "GET",
    path: (a) => `/social-accounts/${a.id}`,
  },
  pfm_disconnect_account: {
    method: "POST",
    path: (a) => `/social-accounts/${a.id}/disconnect`,
  },

  // ── Posts ──────────────────────────────────────────────
  pfm_create_post: {
    method: "POST",
    path: () => "/social-posts",
    body: (a) => {
      const post: Args = {
        caption: a.caption || a.text || "",
        social_accounts: a.social_accounts || [],
      };
      const media = normalizeMediaList(a.media);
      if (media.length > 0) post.media = media;
      if (a.scheduled_at) post.scheduled_at = a.scheduled_at;
      if (a.isDraft) post.isDraft = true;
      if (a.platform_configurations) post.platform_configurations = a.platform_configurations;
      if (a.account_configurations) {
        post.account_configurations = normalizeAccountConfigurations(a.account_configurations);
      }
      if (a.external_id) post.external_id = a.external_id;
      return post;
    },
  },
  pfm_list_posts: {
    method: "GET",
    path: () => "/social-posts",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.platform) params.set("platform", a.platform);
      if (a.status) params.set("status", a.status);
      if (a.limit) params.set("limit", String(a.limit));
      if (a.offset) params.set("offset", String(a.offset));
      return params.toString();
    },
  },
  pfm_get_post: {
    method: "GET",
    path: (a) => `/social-posts/${a.id}`,
  },
  pfm_update_post: {
    method: "PUT",
    path: (a) => `/social-posts/${a.id}`,
    body: (a) => a.data,
  },
  pfm_delete_post: {
    method: "DELETE",
    path: (a) => `/social-posts/${a.id}`,
  },

  // ── Analytics ─────────────────────────────────────────
  pfm_post_results: {
    method: "GET",
    path: () => "/social-post-results",
    query: (a) => {
      const params = new URLSearchParams();
      if (a.social_account_id) params.set("social_account_id", a.social_account_id);
      if (a.platform) params.set("platform", a.platform);
      if (a.post_id) params.set("post_id", a.post_id);
      if (a.limit) params.set("limit", String(a.limit));
      if (a.offset) params.set("offset", String(a.offset));
      return params.toString();
    },
  },
  pfm_get_post_result: {
    method: "GET",
    path: (a) => `/social-post-results/${a.id}`,
  },
  pfm_account_feed: {
    method: "GET",
    path: (a) => `/social-account-feeds/${a.social_account_id}`,
    query: (a) => {
      const params = new URLSearchParams();
      params.set("expand", "metrics");
      if (a.limit) params.set("limit", String(a.limit));
      if (a.cursor) params.set("cursor", a.cursor);
      return params.toString();
    },
  },

  // ── Media ─────────────────────────────────────────────
  pfm_upload_url: {
    method: "POST",
    path: () => "/media/create-upload-url",
    body: () => ({}),
  },

  // ── Previews ──────────────────────────────────────────
  pfm_preview: {
    method: "POST",
    path: () => "/social-post-previews",
    body: (a) => a.data,
  },

  // ── Webhooks ──────────────────────────────────────────
  pfm_create_webhook: {
    method: "POST",
    path: () => "/webhooks",
    body: (a) => a.data,
  },
  pfm_list_webhooks: {
    method: "GET",
    path: () => "/webhooks",
  },
  pfm_delete_webhook: {
    method: "DELETE",
    path: (a) => `/webhooks/${a.id}`,
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

    // API key from request body, legacy header, or env
    const apiKey =
      (typeof bodyApiKey === "string" && bodyApiKey.trim() ? bodyApiKey.trim() : undefined) ||
      req.headers.get("x-pfm-api-key") ||
      Deno.env.get("POSTFORME_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "POSTFORME_API_KEY não configurada." }),
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

    const queryStr = route.query ? route.query(args) : "";
    const url = `${PFM_BASE}${route.path(args)}${queryStr ? `?${queryStr}` : ""}`;

    const fetchOptions: RequestInit = {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    };

    if (route.body && (route.method === "POST" || route.method === "PUT" || route.method === "PATCH")) {
      fetchOptions.body = JSON.stringify(route.body(args));
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
        JSON.stringify({ error: data.message || `PFM API ${response.status}`, details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("postforme-proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
