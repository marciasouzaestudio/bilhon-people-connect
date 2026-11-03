import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Social Analytics Edge Function — via Apify Actors
 *
 * Verified actor IDs and input schemas (updated 2026-04-02):
 *
 * ── Profile Scrapers ──────────────────────────────────────────────
 * - Instagram:  apify~instagram-profile-scraper    → { usernames: [] }
 * - Twitter/X:  web.harvester~twitter-scraper      → { handles: [], tweetsDesired, includeUserInfo }
 * - TikTok:     apidojo~tiktok-profile-scraper     → { usernames: [], maxItems }
 * - YouTube:    streamers~youtube-channel-scraper   → { startUrls: [{ url }], maxVideos }
 * - Facebook:   apify~facebook-pages-scraper        → { startUrls: [{ url }] }
 * - Threads:    apify~threads-profile-api-scraper   → { usernames: [] }
 * - LinkedIn:   dev_fusion~linkedin-profile-scraper → { profileUrls: [] }
 * - LinkedIn Co: harvestapi~linkedin-company        → { companies: [] }  (auto /company/ URLs)
 * - Pinterest:  apivault_labs~pinterest-scraper      → { profileUrls: [] }
 *
 * ── Enrichment Actors (optional, run when enrich=true) ────────────
 * - YouTube Comments:    streamers~youtube-comments-scraper      → { startUrls, maxComments }
 * - YouTube Transcripts: pintostudio~youtube-transcript-scraper  → { videoUrl, targetLanguage }
 * - TikTok Comments:     apidojo~tiktok-comments-scraper        → { startUrls, maxItems }
 * - Instagram Mentions:  apify~instagram-tagged-scraper          → { username, resultsLimit }
 * - LinkedIn Posts:      harvestapi~linkedin-profile-posts       → { targetUrls, maxPosts }
 * - LinkedIn Brand:      harvestapi~linkedin-post-search         → { searchQueries, maxPosts }
 * - LinkedIn Co. Posts:  harvestapi~linkedin-company-posts       → { targetUrls, maxPosts, scrapeComments }
 * - Facebook Reels:      apify~facebook-reels-scraper            → { startUrls, resultsLimit }
 */

const APIFY_BASE = "https://api.apify.com/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-apify-api-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ──────────────────────────────────────────────────────

interface ActorConfig {
  actorId: string;
  buildInput: (username: string) => Record<string, unknown>;
  normalize: (data: unknown) => ProfileAnalytics;
}

interface EnrichmentData {
  comments?: EnrichmentComment[];
  mentions?: EnrichmentMention[];
  transcripts?: EnrichmentTranscript[];
  companyPosts?: EnrichmentPost[];
  reels?: EnrichmentReel[];
  brandMentions?: EnrichmentPost[];
}

interface EnrichmentComment {
  author: string;
  text: string;
  likes: number;
  date: string;
}

interface EnrichmentMention {
  username: string;
  text: string;
  likes: number;
  comments: number;
  date: string;
  url: string;
  mediaUrl: string;
}

interface EnrichmentTranscript {
  videoUrl: string;
  title: string;
  text: string;
}

interface EnrichmentPost {
  text: string;
  likes: number;
  comments: number;
  shares: number;
  date: string;
  url: string;
}

interface EnrichmentReel {
  text: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  date: string;
  url: string;
}

interface ProfileAnalytics {
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

// deno-lint-ignore no-explicit-any
type A = any;

function safeNum(v: A): number { return typeof v === "number" ? v : 0; }

// ─── Profile Actor Configs ──────────────────────────────────────

const PLATFORMS: Record<string, ActorConfig> = {
  instagram: {
    actorId: "apify~instagram-profile-scraper",
    buildInput: (u) => ({ usernames: [u], resultsLimit: 12 }),
    normalize: (raw) => {
      const arr = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      const posts: A[] = p.latestPosts || p.recentPosts || [];
      const totalLikes = posts.reduce((s: number, x: A) => s + safeNum(x.likesCount || x.likes), 0);
      const totalComments = posts.reduce((s: number, x: A) => s + safeNum(x.commentsCount || x.comments), 0);
      const cnt = posts.length || 1;
      const followers = safeNum(p.followersCount || p.followers);
      const avgL = Math.round(totalLikes / cnt);
      const avgC = Math.round(totalComments / cnt);
      return {
        platform: "instagram",
        username: p.username || "",
        displayName: p.fullName || p.username || "",
        profileImageUrl: p.profilePicUrl || p.profilePicUrlHD || "",
        followers,
        following: safeNum(p.followsCount || p.followingCount),
        posts: safeNum(p.postsCount || p.mediaCount),
        engagementRate: followers > 0 ? +((avgL + avgC) / followers * 100).toFixed(2) : null,
        avgLikes: avgL,
        avgComments: avgC,
        avgViews: null,
        recentPosts: posts.slice(0, 6).map((x: A) => ({
          text: x.caption || "",
          likes: safeNum(x.likesCount || x.likes),
          comments: safeNum(x.commentsCount || x.comments),
          views: safeNum(x.videoViewCount || x.playCount || x.videoPlayCount),
          date: x.timestamp || "",
          url: x.url || `https://instagram.com/p/${x.shortCode || ""}`,
          mediaUrl: x.displayUrl || x.thumbnailUrl || "",
        })),
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  twitter: {
    // UPGRADED: web.harvester~twitter-scraper (4.9★, 7.4K users)
    // Returns tweets WITH user info → enables engagement rate calculation
    actorId: "web.harvester~twitter-scraper",
    buildInput: (u) => ({
      handles: [u.replace(/^@/, "")],
      tweetsDesired: 10,
      includeUserInfo: true,
      storeUserIfNoTweets: true,
    }),
    normalize: (raw) => {
      const items: A[] = Array.isArray(raw) ? raw : [raw];
      if (!items.length) {
        return {
          platform: "twitter", username: "", displayName: "", profileImageUrl: "",
          followers: 0, following: 0, posts: 0, engagementRate: null,
          avgLikes: null, avgComments: null, avgViews: null,
          recentPosts: [], fetchedAt: new Date().toISOString(),
        };
      }

      // Extract user info — web.harvester returns user object with totalFollowers, avatar, etc.
      const first = items[0];
      const user = first.user || first;
      const username = user.username || first.username || "";
      const displayName = user.userFullName || user.fullname || first.fullname || user.name || "";
      const profilePic = (user.avatar || user.profileImageUrl || first.profilePicture || "")
        .replace("_normal.", "_400x400.");
      const followers = safeNum(user.totalFollowers || user.followersCount || first.followers);
      const following = safeNum(user.totalFollowing || user.followingCount || first.following);
      const totalTweets = safeNum(user.totalTweets || user.statusesCount || first.statusesCount);

      // Filter to tweet items (have text content)
      const tweets = items.filter((t: A) => t.text || t.full_text);
      const cnt = tweets.length || 1;

      // web.harvester uses: likes, replies, retweets, quotes at top level
      const totalLikes = tweets.reduce((s: number, t: A) => s + safeNum(t.likes || t.likeCount || t.favorite_count), 0);
      const totalReplies = tweets.reduce((s: number, t: A) => s + safeNum(t.replies || t.replyCount || t.reply_count), 0);
      const totalRetweets = tweets.reduce((s: number, t: A) => s + safeNum(t.retweets || t.retweetCount || t.retweet_count), 0);
      const totalViews = tweets.reduce((s: number, t: A) => s + safeNum(t.viewCount || t.views || t.impressions), 0);

      const avgL = Math.round(totalLikes / cnt);
      const avgC = Math.round(totalReplies / cnt);
      const avgV = totalViews > 0 ? Math.round(totalViews / cnt) : null;

      return {
        platform: "twitter",
        username,
        displayName,
        profileImageUrl: profilePic,
        followers,
        following,
        posts: totalTweets,
        engagementRate: followers > 0 ? +((avgL + avgC + Math.round(totalRetweets / cnt)) / followers * 100).toFixed(2) : null,
        avgLikes: avgL,
        avgComments: avgC,
        avgViews: avgV,
        recentPosts: tweets.slice(0, 6).map((t: A) => ({
          text: t.text || t.full_text || "",
          likes: safeNum(t.likes || t.likeCount),
          comments: safeNum(t.replies || t.replyCount),
          views: safeNum(t.viewCount || t.views),
          date: t.timestamp || t.createdAt || t.created_at || "",
          url: t.url || (t.id ? `https://x.com/${username}/status/${t.id}` : ""),
          mediaUrl: (t.media?.[0]?.url || t.media?.[0]?.media_url_https || ""),
        })),
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  tiktok: {
    // UPGRADED: apidojo~tiktok-profile-scraper (4.4★, 2.4K users)
    // 98% success rate, 425 posts/sec, 40+ data fields per profile
    actorId: "apidojo~tiktok-profile-scraper",
    buildInput: (u) => {
      // Extrair handle de URL ou usar direto
      let handle = u.replace(/^@/, "");
      if (handle.includes("tiktok.com")) {
        const parts = handle.replace(/\/+$/, "").split("/");
        handle = (parts[parts.length - 1] || "").replace(/^@/, "");
      }
      console.log(`[social-analytics] TikTok handle: "${handle}" (from input: "${u}")`);
      return { usernames: [handle], maxItems: 12 };
    },
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      // apidojo returns flat items: first may be profile, rest are videos
      // Or profile object with nested videos
      const first = arr[0] || {};
      const stats = first.stats || first.authorStats || {};

      // Check if items are videos or profile+videos mixed
      const isProfile = !!(first.uniqueId || first.user || stats.followerCount);
      const p = isProfile ? first : {};
      const userObj = p.user || p;
      const userStats = p.stats || userObj.stats || stats;

      const videos: A[] = p.latestVideos || p.videos || p.items ||
        arr.filter((x: A) => x.desc || x.text || x.videoUrl || x.webVideoUrl);
      const cnt = videos.length || 1;

      const totalLikes = videos.reduce((s: number, v: A) => s + safeNum(v.diggCount || v.stats?.diggCount || v.likes || v.likesCount), 0);
      const totalComments = videos.reduce((s: number, v: A) => s + safeNum(v.commentCount || v.stats?.commentCount || v.comments || v.commentsCount), 0);
      const totalViews = videos.reduce((s: number, v: A) => s + safeNum(v.playCount || v.stats?.playCount || v.plays || v.viewCount), 0);

      const followers = safeNum(userStats.followerCount || p.fans || p.followerCount || userObj.followerCount);
      const avgL = Math.round(totalLikes / cnt);

      return {
        platform: "tiktok",
        username: userObj.uniqueId || p.uniqueId || p.name || "",
        displayName: userObj.nickname || p.nickname || p.nickName || "",
        profileImageUrl: userObj.avatarLarger || p.avatarLarger || p.avatar || userObj.avatarMedium || "",
        followers,
        following: safeNum(userStats.followingCount || p.following || p.followingCount || userObj.followingCount),
        posts: safeNum(userStats.videoCount || p.videoCount || userObj.videoCount),
        engagementRate: followers > 0 ? +(avgL / followers * 100).toFixed(2) : null,
        avgLikes: avgL,
        avgComments: Math.round(totalComments / cnt),
        avgViews: Math.round(totalViews / cnt),
        recentPosts: videos.slice(0, 6).map((v: A) => ({
          text: v.desc || v.text || "",
          likes: safeNum(v.diggCount || v.stats?.diggCount || v.likes),
          comments: safeNum(v.commentCount || v.stats?.commentCount || v.comments),
          views: safeNum(v.playCount || v.stats?.playCount || v.plays),
          date: v.createTime ? new Date((typeof v.createTime === "number" ? v.createTime * 1000 : Date.parse(v.createTime))).toISOString() : (v.createTimeISO || ""),
          url: v.webVideoUrl || v.url || "",
          mediaUrl: v.cover || v.dynamicCover || v.originCover || "",
        })),
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  youtube: {
    actorId: "streamers~youtube-channel-scraper",
    buildInput: (u) => ({
      startUrls: [{ url: u.startsWith("http") ? u : `https://www.youtube.com/@${u}` }],
      maxVideos: 3,
    }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      const videos: A[] = p.videos || p.latestVideos || [];
      const cnt = videos.length || 1;
      const totalViews = videos.reduce((s: number, v: A) => s + safeNum(v.viewCount || v.views), 0);
      const totalLikes = videos.reduce((s: number, v: A) => s + safeNum(v.likes || v.likeCount), 0);
      const totalComments = videos.reduce((s: number, v: A) => s + safeNum(v.commentsCount || v.commentCount), 0);
      const subs = safeNum(p.subscriberCount || p.subscribers || p.subscribersCount);
      return {
        platform: "youtube",
        username: p.channelName || p.title || "",
        displayName: p.channelName || p.title || "",
        profileImageUrl: p.avatar || p.thumbnailUrl || p.channelImage || "",
        followers: subs,
        following: 0,
        posts: safeNum(p.videoCount || p.videosCount),
        engagementRate: subs > 0 ? +(Math.round(totalLikes / cnt) / subs * 100).toFixed(2) : null,
        avgLikes: Math.round(totalLikes / cnt),
        avgComments: Math.round(totalComments / cnt),
        avgViews: Math.round(totalViews / cnt),
        recentPosts: videos.slice(0, 6).map((v: A) => ({
          text: v.title || "",
          likes: safeNum(v.likes || v.likeCount),
          comments: safeNum(v.commentsCount || v.commentCount),
          views: safeNum(v.viewCount || v.views),
          date: v.date || v.publishedAt || v.uploadDate || "",
          url: v.url || "",
          mediaUrl: v.thumbnailUrl || v.thumbnail || "",
        })),
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  facebook: {
    actorId: "apify~facebook-pages-scraper",
    buildInput: (u) => ({
      startUrls: [{ url: u.startsWith("http") ? u : `https://www.facebook.com/${u}/` }],
      scrapeAbout: true,
      scrapePosts: true,
      scrapeReviews: false,
      maxPosts: 12,
    }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      const profile = p.personalProfile || {};

      // O actor retorna campos variados dependendo do tipo de página
      const followers = safeNum(
        p.likes || p.followers || p.followersCount ||
        p.likeCount || p.followerCount ||
        profile.friends || profile.followersCount || 0
      );

      const posts: A[] = p.posts || p.latestPosts || [];
      const cnt = posts.length || 1;
      const totalLikes = posts.reduce((s: number, v: A) => s + safeNum(v.likes || v.likesCount || v.reactions || 0), 0);
      const totalComments = posts.reduce((s: number, v: A) => s + safeNum(v.comments || v.commentsCount || 0), 0);
      const totalShares = posts.reduce((s: number, v: A) => s + safeNum(v.shares || v.sharesCount || 0), 0);
      const avgL = Math.round(totalLikes / cnt);

      return {
        platform: "facebook",
        username: p.pageName || p.pageUrl || p.name || "",
        displayName: p.title || p.name || profile.name || "",
        profileImageUrl: profile.profilePicLarge || profile.profilePicMedium || p.profileImage || p.imageUrl || "",
        followers,
        following: 0,
        posts: safeNum(p.postsCount || posts.length || 0),
        engagementRate: followers > 0 ? +(avgL / followers * 100).toFixed(2) : null,
        avgLikes: avgL,
        avgComments: Math.round(totalComments / cnt),
        avgViews: null,
        recentPosts: posts.slice(0, 6).map((v: A) => ({
          text: v.text || v.message || v.postText || "",
          likes: safeNum(v.likes || v.likesCount || v.reactions || 0),
          comments: safeNum(v.comments || v.commentsCount || 0),
          views: safeNum(v.views || v.viewCount || 0),
          date: v.time || v.timestamp || v.postedAt || "",
          url: v.postUrl || v.url || "",
          mediaUrl: v.imageUrl || v.fullPicture || v.media?.[0]?.url || "",
        })),
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  threads: {
    actorId: "apify~threads-profile-api-scraper",
    buildInput: (u) => ({ usernames: [u] }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      return {
        platform: "threads",
        username: p.username || "",
        displayName: p.full_name || p.fullName || "",
        profileImageUrl: p.hd_profile_pic_url_info?.url || p.profile_pic_url || "",
        followers: safeNum(p.follower_count || p.followersCount),
        following: 0,
        posts: 0,
        engagementRate: null,
        avgLikes: null,
        avgComments: null,
        avgViews: null,
        recentPosts: [],
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  linkedin: {
    // Personal profile scraper (auto-detected; for /company/ URLs see linkedin_company)
    actorId: "dev_fusion~linkedin-profile-scraper",
    buildInput: (u) => ({
      profileUrls: [u.startsWith("http") ? u : `https://www.linkedin.com/in/${u}`],
    }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      if (p.error) throw new Error(p.error);
      return {
        platform: "linkedin",
        username: p.publicIdentifier || p.linkedinUrl?.split("/in/")?.[1]?.replace(/\//g, "") || "",
        displayName: p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        profileImageUrl: p.profilePicture || "",
        followers: safeNum(p.followers || p.followersCount),
        following: 0,
        posts: 0,
        engagementRate: null,
        avgLikes: null,
        avgComments: null,
        avgViews: null,
        recentPosts: [],
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  // LinkedIn Company Page — used automatically when URL contains /company/
  linkedin_company: {
    actorId: "harvestapi~linkedin-company",
    buildInput: (u) => ({
      companies: [u.startsWith("http") ? u : `https://www.linkedin.com/company/${u}/`],
    }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      return {
        platform: "linkedin",
        username: p.universalName || p.companyUrl?.split("/company/")?.[1]?.replace(/\//g, "") || "",
        displayName: p.name || p.companyName || "",
        profileImageUrl: p.logo || p.logoUrl || p.avatar?.url || "",
        followers: safeNum(p.followerCount || p.followersCount || p.followers),
        following: 0,
        posts: 0,
        engagementRate: null,
        avgLikes: null,
        avgComments: null,
        avgViews: null,
        recentPosts: [],
        fetchedAt: new Date().toISOString(),
      };
    },
  },

  pinterest: {
    actorId: "apivault_labs~pinterest-scraper",
    buildInput: (u) => ({
      profileUrls: [u.startsWith("http") ? u : `https://www.pinterest.com/${u}/`],
    }),
    normalize: (raw) => {
      const arr: A[] = Array.isArray(raw) ? raw : [raw];
      const p = arr[0] || {};
      return {
        platform: "pinterest",
        username: p.username || "",
        displayName: p.fullName || p.full_name || "",
        profileImageUrl: p.profileImage || p.image_xlarge_url || "",
        followers: safeNum(p.followerCount || p.follower_count),
        following: safeNum(p.followingCount || p.following_count),
        posts: safeNum(p.pinCount || p.pin_count),
        engagementRate: null,
        avgLikes: null,
        avgComments: null,
        avgViews: null,
        recentPosts: [],
        fetchedAt: new Date().toISOString(),
      };
    },
  },
};

// Platforms without Apify actors
const UNSUPPORTED_REASONS: Record<string, string> = {
  bluesky: "Bluesky não possui scraper disponível",
};

// ─── Enrichment Actor Configs ───────────────────────────────────

interface EnrichmentActorConfig {
  actorId: string;
  /** Return null to skip enrichment for this profile */
  buildInput: (profile: ProfileAnalytics, username: string) => Record<string, unknown> | null;
  /** Merge enrichment data into the profile */
  merge: (profile: ProfileAnalytics, data: unknown) => void;
}

const ENRICHMENTS: Record<string, EnrichmentActorConfig[] | string> = {
  youtube: [
    {
      // YouTube Comments — fetch top comments from latest video
      actorId: "streamers~youtube-comments-scraper",
      buildInput: (profile) => {
        const videoUrl = profile.recentPosts?.[0]?.url;
        if (!videoUrl) return null;
        return { startUrls: [{ url: videoUrl }], maxComments: 20, commentsSortBy: "top" };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!profile.enrichment) profile.enrichment = {};
        profile.enrichment.comments = items.slice(0, 20).map((c: A) => ({
          author: c.author || c.authorDisplayName || "",
          text: c.comment || c.text || c.textDisplay || "",
          likes: safeNum(c.voteCount || c.votes || c.likeCount),
          date: c.publishedAt || c.date || "",
        }));
      },
    },
    {
      // YouTube Transcript — get transcript of latest video
      actorId: "pintostudio~youtube-transcript-scraper",
      buildInput: (profile) => {
        const videoUrl = profile.recentPosts?.[0]?.url;
        if (!videoUrl) return null;
        return { videoUrl, targetLanguage: "pt" };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [raw];
        const item = items[0];
        if (!item) return;
        if (!profile.enrichment) profile.enrichment = {};
        if (!profile.enrichment.transcripts) profile.enrichment.transcripts = [];
        // pintostudio returns { searchResult: [{ start, dur, text }] } — join segments
        const segments: A[] = item.searchResult || item.captions || [];
        const text = segments.length > 0
          ? segments.map((s: A) => s.text || "").join(" ")
          : (item.transcript || item.text || item.content || "");
        if (text) {
          profile.enrichment.transcripts.push({
            videoUrl: profile.recentPosts?.[0]?.url || "",
            title: item.title || profile.recentPosts?.[0]?.text || "",
            text: typeof text === "string" ? text.slice(0, 5000) : "",
          });
        }
      },
    },
  ],

  tiktok: [
    {
      // TikTok Comments — fetch comments from latest video
      actorId: "apidojo~tiktok-comments-scraper",
      buildInput: (profile) => {
        const videoUrl = profile.recentPosts?.[0]?.url;
        if (!videoUrl) return null;
        return { startUrls: [{ url: videoUrl }], maxItems: 20 };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!profile.enrichment) profile.enrichment = {};
        // apidojo returns: text, likeCount, replyCount, createdAt (ISO), user.username, user.displayName
        profile.enrichment.comments = items.slice(0, 20).map((c: A) => ({
          author: c.user?.username || c.user?.displayName || c.uniqueId || c.nickname || "",
          text: c.text || c.comment || "",
          likes: safeNum(c.likeCount || c.diggCount || c.likes),
          date: c.createdAt || c.createTimeISO || "",
        }));
      },
    },
  ],

  instagram: [
    {
      // Instagram Mentions — tagged posts mentioning the user
      actorId: "apify~instagram-tagged-scraper",
      buildInput: (_profile, username) => {
        if (!username) return null;
        return { username: [username], resultsLimit: 10 };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!profile.enrichment) profile.enrichment = {};
        // apify~instagram-tagged-scraper: caption, commentsCount, shortCode, url, type, latestComments
        profile.enrichment.mentions = items.slice(0, 10).map((m: A) => ({
          username: m.ownerUsername || m.latestComments?.[0]?.ownerUsername || m.owner?.username || "",
          text: m.caption || m.text || "",
          likes: safeNum(m.likesCount || m.likes),
          comments: safeNum(m.commentsCount || m.comments),
          date: m.timestamp || m.takenAt || "",
          url: m.url || `https://instagram.com/p/${m.shortCode || ""}`,
          mediaUrl: m.displayUrl || m.thumbnailUrl || "",
        }));
      },
    },
  ],

  linkedin: [
    {
      // LinkedIn Profile/Company Posts — auto-detects personal vs company
      // Uses harvestapi~linkedin-profile-posts (same API as company-posts, works for both)
      actorId: "harvestapi~linkedin-profile-posts",
      buildInput: (_profile, username) => {
        let url: string;
        if (username.startsWith("http")) {
          url = username;
        } else if (username.includes("/company/")) {
          url = `https://www.linkedin.com/company/${username}/`;
        } else {
          url = `https://www.linkedin.com/in/${username}`;
        }
        return {
          targetUrls: [url],
          maxPosts: 5,
          scrapeComments: true,
          maxComments: 3,
          postNestedComments: true,
        };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!items.length) return;
        if (!profile.enrichment) profile.enrichment = {};
        // harvestapi returns: content, engagement.{likes,comments,shares}, postedAt.date, linkedinUrl
        profile.enrichment.companyPosts = items.slice(0, 5).map((p: A) => ({
          text: p.content || p.text || p.commentary || "",
          likes: safeNum(p.engagement?.likes || p.totalReactionCount || p.numLikes),
          comments: safeNum(p.engagement?.comments || p.numComments || p.commentCount),
          shares: safeNum(p.engagement?.shares || p.numShares || p.shareCount),
          date: p.postedAt?.date || p.postedDate || p.publishedAt || "",
          url: p.linkedinUrl || p.postUrl || p.url || "",
        }));

        // If profile scrape had no engagement data, compute from posts
        if (profile.engagementRate === null && profile.followers > 0 && items.length > 0) {
          const cnt = items.length;
          const totalLikes = items.reduce((s: number, p: A) => s + safeNum(p.engagement?.likes || p.totalReactionCount || p.numLikes), 0);
          const totalComments = items.reduce((s: number, p: A) => s + safeNum(p.engagement?.comments || p.numComments || p.commentCount), 0);
          const avgL = Math.round(totalLikes / cnt);
          const avgC = Math.round(totalComments / cnt);
          profile.avgLikes = avgL;
          profile.avgComments = avgC;
          profile.engagementRate = +((avgL + avgC) / profile.followers * 100).toFixed(2);
          profile.posts = profile.posts || cnt;
          // Populate recentPosts from enrichment if empty
          if (!profile.recentPosts.length) {
            profile.recentPosts = items.slice(0, 6).map((p: A) => ({
              text: p.content || p.text || p.commentary || "",
              likes: safeNum(p.engagement?.likes || p.totalReactionCount),
              comments: safeNum(p.engagement?.comments || p.numComments),
              views: safeNum(p.numViews || p.viewCount || p.impressionCount),
              date: p.postedAt?.date || p.postedDate || "",
              url: p.linkedinUrl || p.postUrl || p.url || "",
              mediaUrl: p.postImages?.[0] || p.images?.[0] || p.image || "",
            }));
          }
        }
      },
    },
    {
      // LinkedIn Brand Monitoring — search posts mentioning the user/brand
      actorId: "harvestapi~linkedin-post-search",
      buildInput: (profile) => {
        // Use displayName or username as search query for brand mentions
        const query = profile.displayName || profile.username;
        if (!query || query.length < 3) return null;
        return {
          searchQueries: [query],
          maxPosts: 5,
          postedLimit: "month",
          sortBy: "date",
        };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!items.length) return;
        if (!profile.enrichment) profile.enrichment = {};
        profile.enrichment.brandMentions = items.slice(0, 5).map((p: A) => ({
          text: p.content || p.text || p.commentary || "",
          likes: safeNum(p.engagement?.likes || p.totalReactionCount || p.numLikes),
          comments: safeNum(p.engagement?.comments || p.numComments || p.commentCount),
          shares: safeNum(p.engagement?.shares || p.numShares || p.shareCount),
          date: p.postedAt?.date || p.postedDate || p.publishedAt || "",
          url: p.linkedinUrl || p.postUrl || p.url || "",
        }));
      },
    },
  ],

  // Also apply enrichments for linkedin_company (same enrichments as personal)
  linkedin_company: "linkedin",

  facebook: [
    {
      // Facebook Reels — reels from the page
      actorId: "apify~facebook-reels-scraper",
      buildInput: (_profile, username) => {
        const url = username.startsWith("http") ? username : `https://www.facebook.com/${username}/`;
        return { startUrls: [{ url }], resultsLimit: 5 };
      },
      merge: (profile, raw) => {
        const items: A[] = Array.isArray(raw) ? raw : [];
        if (!items.length) return;
        if (!profile.enrichment) profile.enrichment = {};
        profile.enrichment.reels = items.slice(0, 5).map((r: A) => ({
          text: r.text || r.postText || r.description || "",
          likes: safeNum(r.likesCount || r.likes || r.reactions),
          comments: safeNum(r.commentsCount || r.comments),
          shares: safeNum(r.sharesCount || r.shares),
          views: safeNum(r.viewCount || r.views || r.playsCount || r.plays),
          date: r.time || r.date || r.timestamp || "",
          url: r.url || r.postUrl || "",
        }));

        // Enrich Facebook engagement from reels if profile had no data
        if (profile.engagementRate === null && profile.followers > 0 && items.length > 0) {
          const cnt = items.length;
          const totalLikes = items.reduce((s: number, r: A) => s + safeNum(r.likesCount || r.likes || r.reactions), 0);
          const totalComments = items.reduce((s: number, r: A) => s + safeNum(r.commentsCount || r.comments), 0);
          const totalViews = items.reduce((s: number, r: A) => s + safeNum(r.viewCount || r.views || r.playsCount), 0);
          profile.avgLikes = Math.round(totalLikes / cnt);
          profile.avgComments = Math.round(totalComments / cnt);
          profile.avgViews = totalViews > 0 ? Math.round(totalViews / cnt) : null;
          profile.engagementRate = +((profile.avgLikes + profile.avgComments) / profile.followers * 100).toFixed(2);
          // Populate recentPosts from reels if empty
          if (!profile.recentPosts.length) {
            profile.recentPosts = items.slice(0, 6).map((r: A) => ({
              text: r.text || r.postText || r.description || "",
              likes: safeNum(r.likesCount || r.likes || r.reactions),
              comments: safeNum(r.commentsCount || r.comments),
              views: safeNum(r.viewCount || r.views || r.playsCount),
              date: r.time || r.date || "",
              url: r.url || r.postUrl || "",
              mediaUrl: r.thumbnailUrl || r.thumbnail || r.videoUrl || "",
            }));
          }
        }
      },
    },
  ],
};

// ─── Re-host profile images ─────────────────────────────────────

async function reHostImage(url: string, name: string): Promise<string> {
  if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=7c3aed&color=fff`;

  if (!url.includes("cdninstagram.com") && !url.includes("tiktokcdn.com") && !url.includes("pbs.twimg.com")) {
    return url;
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${base64}`;
    }
  } catch {
    // fall through
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=7c3aed&color=fff`;
}

// ─── Apify Runner ───────────────────────────────────────────────

async function runActor(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  timeout = 120
): Promise<unknown> {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeout}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Enrichment Runner ──────────────────────────────────────────

async function runEnrichments(
  token: string,
  profile: ProfileAnalytics,
  username: string,
): Promise<void> {
  let enrichKey = profile.platform;
  // Resolve aliases (e.g. linkedin_company → linkedin)
  const entry = ENRICHMENTS[enrichKey];
  if (typeof entry === "string") enrichKey = entry;
  const configs = ENRICHMENTS[enrichKey];
  if (!Array.isArray(configs) || !configs.length) return;

  await Promise.allSettled(
    configs.map(async (cfg) => {
      try {
        const input = cfg.buildInput(profile, username);
        if (!input) return; // skip
        const data = await runActor(token, cfg.actorId, input, 90);
        cfg.merge(profile, data);
      } catch (err) {
        // Enrichment failures are non-fatal — log and continue
        console.warn(`Enrichment ${cfg.actorId} failed for ${profile.platform}/${username}:`, err);
      }
    })
  );
}

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
    const apifyToken =
      req.headers.get("x-apify-api-token") ||
      Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) {
      return new Response(
        JSON.stringify({
          error: "APIFY_API_TOKEN não configurada. Configure no Setup da plataforma.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accounts, enrich = false } = (await req.json()) as {
      accounts: { platform: string; username: string }[];
      enrich?: boolean;
    };

    if (!accounts?.length) {
      return new Response(
        JSON.stringify({ error: "Missing 'accounts' array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ProfileAnalytics[] = [];
    const errors: { platform: string; username: string; error: string }[] = [];

    // Phase 1: Profile scraping (parallel)
    await Promise.allSettled(
      accounts.map(async ({ platform, username }) => {
        // LinkedIn auto-detection: /company/ URLs use linkedin_company actor
        let resolvedPlatform = platform;
        if (platform === "linkedin" && username.includes("/company/")) {
          resolvedPlatform = "linkedin_company";
        }
        const config = PLATFORMS[resolvedPlatform];
        if (!config) {
          const reason = UNSUPPORTED_REASONS[platform] || `Scraper não disponível para ${platform}`;
          errors.push({ platform, username, error: reason });
          return;
        }
        if (!username || username.includes("<No channel>")) {
          errors.push({ platform, username: username || "", error: "Sem perfil/canal vinculado" });
          return;
        }

        try {
          const input = config.buildInput(username);
          const data = await runActor(apifyToken, config.actorId, input);
          const normalized = config.normalize(data);
          if (!normalized.username) normalized.username = username;
          normalized.profileImageUrl = await reHostImage(
            normalized.profileImageUrl,
            normalized.displayName || normalized.username
          );
          results.push(normalized);
        } catch (err) {
          errors.push({
            platform,
            username,
            error: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      })
    );

    // Phase 2: Enrichment (parallel, only when enrich=true)
    if (enrich) {
      await Promise.allSettled(
        results.map((profile) => {
          const original = accounts.find((a) => a.platform === profile.platform);
          return runEnrichments(apifyToken, profile, original?.username || profile.username);
        })
      );
    }

    return new Response(
      JSON.stringify({ results, errors, fetchedAt: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("social-analytics error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
