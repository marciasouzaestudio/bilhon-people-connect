/**
 * Post for Me (PFM) — unified accounts + posting + analytics.
 *
 * All calls go through the postforme-proxy Edge Function. The PFM key can be
 * set explicitly (setPfmUserKey) or read from the user's saved config.
 */

import { supabase } from "@/lib/app-db-client";
import { getSupabaseUrl, getSavedConfig, baseHeaders } from "./_shared";

// Exported for direct use (e.g. Bluesky auth)
export async function callPfmDirect(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  return callPfm(tool, args);
}

// PFM key can be passed from user config
let _pfmUserKey: string | undefined;
export function setPfmUserKey(key: string | undefined) { _pfmUserKey = key; }
export function getPfmUserKey() { return _pfmUserKey; }

const PFM_FUNCTION = "social_postforme-proxy";

async function pfmHeaders(): Promise<Record<string, string>> {
  const headers = baseHeaders();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function getPfmKey(explicitKey?: string): string | undefined {
  const cfg = getSavedConfig();
  return explicitKey || _pfmUserKey || cfg.postformeApiKey;
}

async function callPfm(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const url = `${getSupabaseUrl()}/functions/v1/${PFM_FUNCTION}`;
  const headers = await pfmHeaders();
  const apiKey = getPfmKey();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ tool, args, apiKey }),
  });

  if (!res.ok) {
    let errorMsg: string;
    try { const e = await res.json(); errorMsg = e.error || `HTTP ${res.status}`; }
    catch { errorMsg = `HTTP ${res.status}`; }
    throw new Error(errorMsg);
  }

  return res.json();
}

/** Validate PFM key by listing accounts */
export async function validatePfmKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `${getSupabaseUrl()}/functions/v1/${PFM_FUNCTION}`;
    const headers = await pfmHeaders();
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ tool: "pfm_list_accounts", args: {}, apiKey: key }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { valid: false, error: body.error || `HTTP ${res.status}` };
    }
    setPfmUserKey(key);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

// Accounts
export interface PfmAccount {
  id: string;
  platform: string;
  username: string;
  name: string;
  picture: string;
  status: string;
}

export async function pfmListAccounts(platform?: string): Promise<PfmAccount[]> {
  const args: Record<string, unknown> = {};
  if (platform) args.platform = platform;
  const result = await callPfm("pfm_list_accounts", args) as any;
  return (result.data || [])
    .filter((a: any) => a.status !== "disconnected")  // ignorar contas desconectadas
    .map((a: any) => ({
      id: a.id,
      platform: a.platform === "x" ? "twitter" : a.platform,
      username: a.username || a.platform_username || a.name || a.platform_name || (a.platform === "youtube" ? "YouTube" : ""),
      name: a.name || a.platform_name || a.username || a.platform_username || (a.platform === "youtube" ? "Canal YouTube" : ""),
      picture: a.profile_photo_url || a.picture || a.platform_profile_picture_url || "",
      status: a.status || "active",
    }));
}

export async function pfmAuthUrl(platform: string, connectionType?: string): Promise<string> {
  const args: Record<string, unknown> = { platform: platform === "twitter" ? "x" : platform };
  if (connectionType) args.connection_type = connectionType;
  const result = await callPfm("pfm_auth_url", args) as any;
  return result.url || "";
}

export async function pfmDisconnectAccount(id: string): Promise<void> {
  await callPfm("pfm_disconnect_account", { id });
}

// Posts
export interface PfmCreatePostParams {
  caption: string;
  social_accounts: string[];
  media?: Array<string | { url: string; [key: string]: unknown }>;
  scheduled_at?: string;
  account_configurations?: {
    social_account_id: string;
    configuration: Record<string, unknown> & {
      media?: Array<string | { url: string; [key: string]: unknown }>;
    };
  }[];
}

export async function pfmCreatePost(params: PfmCreatePostParams): Promise<any> {
  return callPfm("pfm_create_post", params as unknown as Record<string, unknown>);
}

export async function pfmListPosts(opts?: { platform?: string; status?: string; limit?: number }): Promise<any> {
  return callPfm("pfm_list_posts", opts || {});
}

export async function pfmDeletePost(id: string): Promise<void> {
  await callPfm("pfm_delete_post", { id });
}

// Analytics
export async function pfmAccountFeed(socialAccountId: string, limit = 20, cursor?: string): Promise<any> {
  const args: Record<string, unknown> = { social_account_id: socialAccountId, limit };
  if (cursor) args.cursor = cursor;
  return callPfm("pfm_account_feed", args);
}

// ── Feed normalizado (engajamento por post) ──────────────────────
// O pfm_account_feed (expand=metrics) traz métricas por plataforma com
// formatos diferentes (oneOf no OpenAPI). Normalizamos para um subconjunto
// comum tolerante a campos ausentes — métricas variam por rede.
export interface PfmFeedMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  reach?: number;
  impressions?: number;
}

export interface PfmFeedPost {
  id: string;
  postedAt?: string;
  caption?: string;
  platformUrl?: string;
  thumbUrl?: string;
  metrics: PfmFeedMetrics;
  hasMetrics: boolean;
}

function pfmNum(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

// media do PlatformPostDto é heterogêneo entre plataformas — procura a 1ª URL.
function pfmPickThumb(media: unknown): string | undefined {
  const urls: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(media);
  return urls.find((u) => /\.(jpg|jpeg|png|webp|gif)/i.test(u)) || urls[0];
}

/** Normaliza a resposta do pfm_account_feed (expand=metrics) para a UI. */
export function normalizePfmFeed(raw: any): { posts: PfmFeedPost[]; cursor?: string } {
  const items: any[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const posts: PfmFeedPost[] = items.map((p, i) => {
    const m = (p?.metrics || {}) as Record<string, unknown>;
    const metrics: PfmFeedMetrics = {
      likes: pfmNum(m.likes),
      comments: pfmNum(m.comments),
      shares: pfmNum(m.shares ?? m.reposts ?? m.retweets ?? m.quotes),
      saves: pfmNum(m.saves ?? m.bookmarks),
      views: pfmNum(m.views ?? m.video_views ?? m.plays),
      reach: pfmNum(m.reach),
      impressions: pfmNum(m.impressions),
    };
    const hasMetrics = Object.values(metrics).some((v) => v !== undefined);
    return {
      id: String(p?.id ?? p?.platform_post_id ?? p?.social_post_id ?? `feed-${i}`),
      postedAt: typeof p?.posted_at === "string" ? p.posted_at : undefined,
      caption: typeof p?.caption === "string" ? p.caption : undefined,
      platformUrl: typeof p?.platform_url === "string" ? p.platform_url : undefined,
      thumbUrl: pfmPickThumb(p?.media),
      metrics,
      hasMetrics,
    };
  });
  return { posts, cursor: raw?.meta?.cursor };
}

// Media upload
export async function pfmCreateUploadUrl(): Promise<{ media_url: string; upload_url: string }> {
  const result = await callPfm("pfm_upload_url", {}) as any;
  // PFM API may nest under .data or return flat
  const data = result?.data ?? result;
  if (!data?.media_url || !data?.upload_url) {
    throw new Error("PFM upload URL response missing media_url or upload_url");
  }
  return { media_url: data.media_url, upload_url: data.upload_url };
}
