/**
 * Zernio — unified accounts + posting + analytics.
 *
 * Camada de adaptação de publicação: mantém a superfície `pfm*` usada pelos
 * call-sites, mas agora fala com o zernio-proxy Edge Function (Zernio API).
 * A chave pode ser definida explicitamente (setPfmUserKey) ou lida da config
 * salva do usuário.
 */

import { supabase } from "@/lib/app-db-client";
import { getSavedConfig } from "./_shared";

// Exported for direct use (e.g. Bluesky auth)
export async function callPfmDirect(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  return callPfm(tool, args);
}

// Chave do Zernio pode vir da config do usuário
let _pfmUserKey: string | undefined;
export function setPfmUserKey(key: string | undefined) { _pfmUserKey = key; }
export function getPfmUserKey() { return _pfmUserKey; }

const PFM_FUNCTION = "zernio-proxy";
// A ponte do Zernio vive no Lovable Cloud, separada do serviço de contas original.
const ZERNIO_BRIDGE_URL = "https://vksfugcrvvjedvkzsfpa.supabase.co";
const ZERNIO_BRIDGE_KEY = "sb_publishable_HREABA_CxHsqc1EWzQI6aw_FYqkCRRG";

async function pfmHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: ZERNIO_BRIDGE_KEY };
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
  const url = `${ZERNIO_BRIDGE_URL}/functions/v1/${PFM_FUNCTION}`;
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

/** Valida a chave do Zernio listando contas */
export async function validatePfmKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `${ZERNIO_BRIDGE_URL}/functions/v1/${PFM_FUNCTION}`;
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
  const items: any[] = result?.data || result?.accounts || (Array.isArray(result) ? result : []);
  return items
    .filter((a: any) => a.status !== "disconnected")  // ignorar contas desconectadas
    .map((a: any) => ({
      id: String(a.id || a._id),
      platform: a.platform === "x" ? "twitter" : a.platform,
      username: a.username || a.platform_username || a.handle || a.name || a.platform_name || (a.platform === "youtube" ? "YouTube" : ""),
      name: a.name || a.platform_name || a.username || a.handle || (a.platform === "youtube" ? "Canal YouTube" : ""),
      picture: a.profilePicture || a.profile_picture || a.profile_photo_url || a.picture || a.avatar || "",
      status: a.status || "connected",
    }));
}

export async function pfmAuthUrl(platform: string, connectionType?: string): Promise<string> {
  const args: Record<string, unknown> = { platform: platform === "twitter" ? "twitter" : platform };
  if (connectionType) args.connection_type = connectionType;
  args.redirect_url = window.location.origin + "/accounts";
  const result = await callPfm("pfm_auth_url", args) as any;
  return result.url || result.authUrl || "";
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
// O feed de analytics traz métricas por plataforma com formatos diferentes.
// Normalizamos para um subconjunto comum tolerante a campos ausentes —
// métricas variam por rede.
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

// media heterogênea entre plataformas — procura a 1ª URL.
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

/** Normaliza a resposta do feed de analytics para a UI. */
export function normalizePfmFeed(raw: any): { posts: PfmFeedPost[]; cursor?: string } {
  const items: any[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const posts: PfmFeedPost[] = items.map((p, i) => {
    const m = (p?.metrics || p?.analytics || {}) as Record<string, unknown>;
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
      id: String(p?.id ?? p?.postId ?? p?.platform_post_id ?? p?.social_post_id ?? `feed-${i}`),
      postedAt: typeof p?.posted_at === "string" ? p.posted_at
        : typeof p?.publishedAt === "string" ? p.publishedAt
        : typeof p?.createdAt === "string" ? p.createdAt : undefined,
      caption: typeof p?.caption === "string" ? p.caption
        : typeof p?.content === "string" ? p.content : undefined,
      platformUrl: typeof p?.platform_url === "string" ? p.platform_url
        : typeof p?.platformUrl === "string" ? p.platformUrl : undefined,
      thumbUrl: pfmPickThumb(p?.media ?? p?.mediaItems),
      metrics,
      hasMetrics,
    };
  });
  return { posts, cursor: raw?.meta?.cursor ?? raw?.cursor };
}

// Media upload
export async function pfmCreateUploadUrl(
  opts?: { filename?: string; contentType?: string; size?: number }
): Promise<{ media_url: string; upload_url: string }> {
  const result = await callPfm("pfm_upload_url", opts || {}) as any;
  // resposta pode vir aninhada em .data ou plana
  const data = result?.data ?? result;
  if (!data?.media_url || !data?.upload_url) {
    throw new Error("Resposta de upload sem media_url ou upload_url");
  }
  return { media_url: data.media_url, upload_url: data.upload_url };
}
