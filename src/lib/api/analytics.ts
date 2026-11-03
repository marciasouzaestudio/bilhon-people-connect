/**
 * Social analytics via the social-analytics Edge Function (Apify-backed),
 * plus the helpers that build account lists and validate the Apify token.
 */

import { getSupabaseUrl, getSavedConfig, baseHeaders } from "./_shared";

// ─── Social Analytics (Apify) ───────────────────────────────────

export interface EnrichmentComment {
  author: string;
  text: string;
  likes: number;
  date: string;
}

export interface EnrichmentMention {
  username: string;
  text: string;
  likes: number;
  comments: number;
  date: string;
  url: string;
  mediaUrl: string;
}

export interface EnrichmentTranscript {
  videoUrl: string;
  title: string;
  text: string;
}

export interface EnrichmentPost {
  text: string;
  likes: number;
  comments: number;
  shares: number;
  date: string;
  url: string;
}

export interface EnrichmentReel {
  text: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  date: string;
  url: string;
}

export interface EnrichmentData {
  comments?: EnrichmentComment[];
  mentions?: EnrichmentMention[];
  transcripts?: EnrichmentTranscript[];
  companyPosts?: EnrichmentPost[];
  reels?: EnrichmentReel[];
  brandMentions?: EnrichmentPost[];
}

export interface ProfileAnalytics {
  platform: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
  followers: number;
  following: number;
  posts: number;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgViews: number | null;
  recentPosts: {
    text: string;
    likes: number;
    comments: number;
    views: number;
    date: string;
    url: string;
    mediaUrl: string;
  }[];
  enrichment?: EnrichmentData;
  fetchedAt: string;
}

export interface AnalyticsResult {
  results: ProfileAnalytics[];
  errors: { platform: string; username: string; error: string }[];
  fetchedAt: string;
}

/**
 * Build analytics account list from PFM accounts + saved profile URLs.
 * YouTube and LinkedIn pass the full URL (edge function handles it).
 * Other platforms extract the username/handle from the URL.
 */
export function buildAnalyticsAccounts(
  pfmAccounts: { platform: string; username: string }[],
  profileUrls: Record<string, string>
): { platform: string; username: string }[] {
  return pfmAccounts
    .filter((a) => a.username || profileUrls[a.platform])
    .map((a) => {
      const savedUrl = profileUrls[a.platform] || "";
      let username = a.username || "";

      if (savedUrl) {
        // YouTube, LinkedIn e Facebook: pass full URL (edge function handles parsing)
        if (a.platform === "youtube" || a.platform === "linkedin" || a.platform === "facebook") {
          username = savedUrl;
        } else {
          // Other platforms: extract last segment as username/handle
          const urlParts = savedUrl.replace(/\/+$/, "").split("/");
          const lastPart = urlParts[urlParts.length - 1]?.replace("@", "") || "";
          if (lastPart) username = lastPart;
        }
      }

      if (!username || username === "YouTube" || username === "Canal YouTube") return null;
      return { platform: a.platform, username };
    })
    .filter(Boolean) as { platform: string; username: string }[];
}

export async function fetchAnalytics(
  accounts: { platform: string; username: string }[],
  enrich = false
): Promise<AnalyticsResult> {
  const url = `${getSupabaseUrl()}/functions/v1/social_social-analytics`;
  const cfg = getSavedConfig();
  const headers = baseHeaders();
  if (cfg.apifyApiToken) headers["x-apify-api-token"] = cfg.apifyApiToken;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ accounts, enrich }),
  });

  if (!response.ok) {
    let msg: string;
    try {
      const errBody = await response.json();
      msg = errBody.error || `HTTP ${response.status}`;
    } catch {
      msg = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(msg);
  }

  return response.json();
}

/** Validate Apify token */
export async function validateApifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    if (res.status === 401) return { valid: false, error: "Token inválido" };
    if (!res.ok) return { valid: false, error: `HTTP ${res.status}` };
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}
