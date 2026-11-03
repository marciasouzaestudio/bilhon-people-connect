export type Platform =
  | "instagram"
  | "twitter"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "pinterest"
  | "threads"
  | "bluesky"
  | "youtube";

export interface SubAccount {
  id: string;
  name: string;
  type: string;
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  fullname: string;
  username: string;
  subaccounts: SubAccount[];
  requiredFields: Record<string, string>;
}

export interface ScheduledPost {
  id: string;
  scheduledTime: string;
  draft: {
    accountId: string;
    platform: Platform;
    text: string;
    mediaUrls: string[];
  };
  account: {
    platform: Platform;
    name: string;
    username: string;
  };
}

export interface VisualTemplate {
  id: string;
  description: string;
  inputs: VisualTemplateInput[];
}

export interface VisualTemplateInput {
  name: string;
  label: string;
  description?: string;
  type: Record<string, unknown>;
  default?: unknown;
}

export interface ContentSource {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  title?: string;
  content?: string;
  referenceUrl?: string;
  sourceType: string;
}

export interface AppConfig {
  // Core (obrigatório pra funcionar)
  postformeApiKey: string;
  brandName: string;
  onboardingCompleted?: boolean;
  brandLogo?: string;
  // Opcionais (cada integração é independente)
  pexelsApiKey?: string;
  apifyApiToken?: string;
  firecrawlApiKey?: string;
}

export interface PostDraft {
  text: string;
  mediaUrls: string[];
  platforms: Platform[];
  scheduledTime?: string;
  useNextFreeSlot?: boolean;
  platformSpecific: Record<Platform, Record<string, unknown>>;
}

// ─── Autopilot ──────────────────────────────────────────────────

export type AutopilotVisualFormat = "auto" | "carousel" | "single" | "infographic" | "video" | "none";
export type AutopilotRecurrence = "daily" | "weekly" | "biweekly" | "monthly";

/** Tema/motivo de postagem complementar (dia1=Tema A, dia2=Tema B...). */
export interface AutopilotTheme {
  id?: string;
  name: string;
  subject: string;
  visual_format?: AutopilotVisualFormat;
  reference_accounts?: string[];
  tone?: string;
  days?: number[];
  content_types?: string[];
}
export type AutopilotCalendarStatus = "draft" | "approved" | "scheduling" | "active" | "completed" | "failed";
export type AutopilotPostStatus = "draft" | "approved" | "generating_visual" | "visual_ready" | "scheduled" | "published" | "failed";

export interface AutopilotConfig {
  id: string;
  user_id: string;
  brand_id?: string | null;
  research_topics: string[];
  research_urls: string[];
  themes?: AutopilotTheme[];
  reference_accounts?: string[];
  tone?: string | null;
  platforms: string[];
  social_account_ids: string[];
  posts_per_cycle: number;
  visual_format: AutopilotVisualFormat;
  image_provider?: string;
  video_model?: string | null;
  content_types: string[];
  recurrence: AutopilotRecurrence;
  preferred_days: number[];
  preferred_times: string[];
  timezone: string;
  is_active: boolean;
  requires_approval: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopilotCalendar {
  id: string;
  user_id: string;
  config_id: string;
  cycle_start: string;
  cycle_end: string;
  status: AutopilotCalendarStatus;
  research_results: { url: string; title: string; summary: string }[];
  created_at: string;
  updated_at: string;
}

export interface AutopilotPost {
  id: string;
  user_id: string;
  calendar_id: string;
  platform: string;
  text_content: string;
  hashtags: string[];
  carousel_data?: { title: string; slides: { heading: string; body: string }[] } | null;
  media_urls: string[];
  visual_creation_id?: string | null;
  scheduled_at?: string | null;
  pfm_post_id?: string | null;
  status: AutopilotPostStatus;
  error_message?: string | null;
  source_topic?: string | null;
  source_url?: string | null;
  theme_name?: string | null;
  visual_format?: AutopilotVisualFormat | null;
  created_at: string;
  updated_at: string;
}
