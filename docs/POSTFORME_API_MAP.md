# Post for Me API — Complete Map
## Base URL: https://api.postforme.dev
## Auth: Header `Authorization: Bearer YOUR_API_KEY`
## Source: OpenAPI spec extracted from /docs (69 schemas, 21 endpoints)

---

## Endpoints

### Social Accounts (connection + management)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/social-accounts/auth-url` | Generate OAuth URL for user to connect account |
| POST | `/v1/social-accounts` | Create/update social account |
| GET | `/v1/social-accounts` | List all connected accounts |
| GET | `/v1/social-accounts/{id}` | Get account by ID |
| PATCH | `/v1/social-accounts/{id}` | Update account |
| POST | `/v1/social-accounts/{id}/disconnect` | Disconnect account |

### Social Posts (create + manage)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/social-posts` | Create post (publish or schedule) |
| GET | `/v1/social-posts` | List posts |
| GET | `/v1/social-posts/{id}` | Get post by ID |
| PUT | `/v1/social-posts/{id}` | Update post |
| DELETE | `/v1/social-posts/{id}` | Delete post |

### Analytics (metrics + feed)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/social-post-results` | Get post results with metrics |
| GET | `/v1/social-post-results/{id}` | Get specific result |
| GET | `/v1/social-account-feeds/{id}` | Get account feed. Use `?expand=metrics` for engagement data |

### Media
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/media/create-upload-url` | Get signed upload URL for media files |

### Previews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/social-post-previews` | Generate platform-specific post previews |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/webhooks` | Create webhook |
| GET | `/v1/webhooks` | List webhooks |
| GET | `/v1/webhooks/{id}` | Get webhook |
| PATCH | `/v1/webhooks/{id}` | Update webhook |
| DELETE | `/v1/webhooks/{id}` | Delete webhook |

---

## Key Schemas

### CreateSocialPostDto (create post)
```
caption: string (required) — post text
scheduled_at: string — ISO datetime, null = post now
social_accounts: string[] (required) — account IDs to post to
media: string[] — media URLs
platform_configurations: object — per-platform settings
account_configurations: AccountConfigurationDto[] — per-account overrides
external_id: string — your reference ID
isDraft: boolean — save as draft
```

### AccountConfigurationDto (per-platform post config)
```
social_account_id: string (required)
configuration:
  caption: string — override caption
  media: string[] — override media
  board_ids: string[] — Pinterest boards
  link: string — Pinterest link
  placement: "reels"|"timeline"|"stories" — IG/FB/Threads
  title: string — YouTube/TikTok title
  privacy_status: "public"|"private"|"unlisted" — TikTok/YouTube
  made_for_kids: boolean — YouTube
  allow_comment: boolean — TikTok
  allow_duet: boolean — TikTok
  allow_stitch: boolean — TikTok
  disclose_your_brand: boolean — TikTok
  disclose_branded_content: boolean — TikTok
  is_draft: boolean — TikTok draft
  is_ai_generated: boolean — TikTok
  auto_add_music: boolean — TikTok
  poll: object — Twitter poll
  community_id: string — Twitter community
  quote_tweet_id: string — Twitter quote
  reply_settings: string — Twitter replies
  location: string — IG/FB location tag
  collaborators: string[] — IG collaborators
  share_to_feed: boolean — IG reels to feed
  trial_reel_type: string — IG trial reel
```

### Analytics Metrics (per platform)
```
Instagram: likes, comments, views, reach, saved, shares, follows,
           profile_visits, ig_reels_avg_watch_time
Twitter/X: retweet_count, reply_count, like_count, impression_count,
           bookmark_count
LinkedIn:  clickCount, commentCount, engagement, impressionCount, likeCount
TikTok:    likes, comments, shares, reach, video_views, total_time_watched,
           new_followers, demographics (gender, country, city)
YouTube:   views, likes, comments, average_view_duration,
           subscribers_gained, watch_time
Facebook:  reach, viral_reach, video_views, reactions_total,
           engagement_by_action_type
Threads:   likes, replies, shares, views, quotes, reposts
Pinterest: impressions, outbound_clicks, saves, video_views, watch_time
Bluesky:   replyCount, likeCount, repostCount, quoteCount
```

### Supported Platforms
instagram, x, linkedin, facebook, tiktok, youtube, threads,
pinterest, bluesky

---

## Account Connection Flow
1. POST `/v1/social-accounts/auth-url` → get OAuth URL
2. User clicks URL → authorizes on platform
3. Redirect back → account created automatically
4. GET `/v1/social-accounts` → see connected account

## Post Creation Flow
1. POST `/v1/media/create-upload-url` → get upload URL
2. PUT file to upload URL
3. POST `/v1/social-posts` with media URLs + social_accounts

## Analytics Flow
1. GET `/v1/social-account-feeds/{id}?expand=metrics` → feed with metrics
2. GET `/v1/social-post-results?social_account_id=X` → post results
