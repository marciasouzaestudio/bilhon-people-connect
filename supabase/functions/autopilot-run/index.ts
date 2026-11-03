import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { brandToAIProfile, brandImageDirective, brandVideoDirective, brandVoiceDirective, type BrandRow } from "../_shared/brand.ts";

/**
 * Autopilot Run — Pipeline principal de automação
 *
 * Actions:
 *   generate         — Pesquisa + gera o roteiro de TEXTO do ciclo (Ideias)
 *   generate_visuals — Gera a peça VISUAL dos posts do ciclo (Ideias → Geradas)
 *   curate           — Curadoria de texto por IA dos posts que já têm arte
 *   schedule         — Agenda posts APROVADOS (não gera mais visual)
 *   check_visuals    — Polling dos visuais assíncronos (vídeo/Veo)
 *   confirm          — Confirma publicação real no PFM (scheduled → published)
 *
 * A esteira (as 4 colunas de /autopilot):
 *   draft (Ideias) → generating_visual/visual_ready (Geradas) → approved
 *   (Aprovadas) → scheduled/published (Agendadas)
 * A peça visual é etapa DO CICLO: quem aprova já vê a arte na frente.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Helpers ────────────────────────────────────────────────────

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'app_social' } });
}

function supabaseForUser(authHeader: string) {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { db: { schema: 'app_social' },
    global: { headers: { Authorization: authHeader } },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// Faz upload de um data URL (base64) para o storage `media` e devolve a URL pública.
async function uploadDataUrl(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
  dataUrl: string
): Promise<string | null> {
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const path = `autopilot/${userId}/${crypto.randomUUID()}.png`;
    const { error } = await sb.storage.from("media").upload(path, bytes, { contentType: mime });
    if (error) { console.error("[autopilot] upload error:", error.message); return null; }
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("[autopilot] uploadDataUrl:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── Firecrawl Search ───────────────────────────────────────────

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 5
): Promise<{ url: string; title: string; markdown: string }[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/social_firecrawl-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firecrawl-api-key": apiKey,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// Scrape direto de uma URL (conteúdo real, não SERP) via Firecrawl /v1/scrape.
async function firecrawlScrape(
  apiKey: string,
  url: string
): Promise<{ url: string; title: string; markdown: string } | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md = data?.data?.markdown || data?.markdown || "";
    const title = data?.data?.metadata?.title || data?.metadata?.title || url;
    if (!md) return null;
    return { url, title, markdown: md };
  } catch {
    return null;
  }
}

// ─── AI Content Generation ──────────────────────────────────────
// Reaproveita a MESMA function do Studio (generate-content) para unificar
// qualidade de texto e marca-raiz. Sem implementação de IA divergente aqui.

async function generatePostContent(
  platform: string,
  topic: string,
  researchContext: string,
  brand: BrandRow | null,
  visualFormat: string,
  contentTypes?: string[],
  toneOverride?: string
): Promise<{
  text: string;
  hashtags: string[];
  carousel?: { title: string; slides: { heading: string; body: string }[] };
}> {
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const wantCarousel = visualFormat === "carousel" || visualFormat === "auto";
  const ctLine = contentTypes?.length ? ` Tipo de conteúdo: ${contentTypes.join(", ")}.` : "";

  const res = await fetch(`${SUPABASE_URL}/functions/v1/social_generate-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      prompt: `${topic}.${ctLine}`,
      platforms: [platform],
      tone: toneOverride || brand?.tone,
      language: "português brasileiro",
      sourceContent: researchContext ? researchContext.slice(0, 3000) : undefined,
      brandProfile: brandToAIProfile(brand),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`generate-content ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.posts?.[platform] || Object.values(data.posts || {})[0] || "";
  return {
    text: String(text),
    hashtags: data.hashtags || [],
    carousel: wantCarousel ? data.carousel : undefined,
  };
}

// ─── Referência de contas do Instagram (estilo/inspiração) ──────
// Usa social-analytics (Apify) p/ puxar legendas recentes de @ de referência.
async function fetchIgReferenceContext(apifyToken: string, handles: string[]): Promise<string> {
  const clean = Array.from(new Set(handles.map((h) => String(h).replace(/^@/, "").trim()).filter(Boolean)));
  if (!clean.length || !apifyToken) return "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/social_social-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}`, "x-apify-api-token": apifyToken },
      body: JSON.stringify({ accounts: clean.map((u) => ({ platform: "instagram", username: u })), enrich: false }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const profiles = Array.isArray(data) ? data : (data.profiles || data.results || []);
    const blocks: string[] = [];
    for (const p of profiles) {
      const caps = (p?.recentPosts || []).map((x: { text?: string }) => x?.text).filter(Boolean).slice(0, 5);
      if (caps.length) blocks.push(`Estilo de referência (@${p.username || ""}):\n- ${caps.join("\n- ")}`);
    }
    return blocks.join("\n\n");
  } catch {
    return "";
  }
}

// ─── Compute schedule slots ─────────────────────────────────────

// Map of timezone → UTC offset in hours (negative = behind UTC)
const TZ_OFFSETS: Record<string, number> = {
  "America/Sao_Paulo": -3,
  "America/Manaus": -4,
  "America/Noronha": -2,
  "America/Rio_Branco": -5,
};

// Offset (horas) de um fuso via Intl — robusto e com DST (não mais hardcoded BR).
function tzOffsetHours(timezone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUTC - at.getTime()) / 60000) / 60; // horas
  } catch {
    return -3; // fallback America/Sao_Paulo
  }
}

// Duração do ciclo em dias por recorrência (daily depende de posts/dia).
function cycleLengthDays(recurrence: string, postsPerCycle: number, timesPerDay: number): number {
  if (recurrence === "daily") return Math.max(1, Math.ceil(postsPerCycle / Math.max(1, timesPerDay)));
  if (recurrence === "monthly") return 30;
  if (recurrence === "biweekly") return 14;
  return 7; // weekly
}

export interface Slot { at: Date; dow: number }

function computeSlots(
  postsPerCycle: number,
  preferredDays: number[],
  preferredTimes: string[],
  recurrence: string,
  timezone: string
): Slot[] {
  const slots: Slot[] = [];
  const times = preferredTimes?.length ? preferredTimes : ["09:00"];
  // diária = todos os dias; demais respeitam preferred_days
  const days = recurrence === "daily" ? [0, 1, 2, 3, 4, 5, 6] : (preferredDays?.length ? preferredDays : [1, 3, 5]);
  const window = Math.max(cycleLengthDays(recurrence, postsPerCycle, times.length), 1);

  // Começa "amanhã" no fuso do usuário.
  const tzNow = tzOffsetHours(timezone, new Date());
  const nowLocal = new Date(Date.now() + tzNow * 3600_000);
  const startDate = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate() + 1));

  let dayOffset = 0;
  const maxDays = window + 7; // folga para encontrar dias preferidos
  while (slots.length < postsPerCycle && dayOffset < maxDays) {
    const day = new Date(startDate);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const dow = day.getUTCDay();
    if (days.includes(dow)) {
      for (const time of times) {
        if (slots.length >= postsPerCycle) break;
        const [h, m] = time.split(":").map(Number);
        // Converte hora local → UTC usando o offset DAQUELE dia (DST-safe).
        const off = tzOffsetHours(timezone, day);
        const utcSlot = new Date(day);
        utcSlot.setUTCHours(h - off, m, 0, 0);
        slots.push({ at: utcSlot, dow });
      }
    }
    dayOffset++;
  }
  return slots;
}

function computeNextRun(recurrence: string, postsPerCycle = 5, timesPerDay = 2): Date {
  const next = new Date();
  next.setDate(next.getDate() + cycleLengthDays(recurrence, postsPerCycle, timesPerDay));
  next.setHours(6, 0, 0, 0);
  return next;
}

function cycleRange(recurrence: string, postsPerCycle = 5, timesPerDay = 2): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + cycleLengthDays(recurrence, postsPerCycle, timesPerDay) - 1);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// ─── Temas (motivos complementares) ─────────────────────────────

export interface AutopilotTheme {
  name: string;
  subject: string;
  visual_format?: string;
  reference_accounts: string[];
  tone?: string;
  days?: number[];
  content_types?: string[];
}

// Normaliza config.themes; cai para research_topics (legado) se não houver temas.
export function normalizeThemes(config: Record<string, unknown>): AutopilotTheme[] {
  const raw = Array.isArray(config.themes) ? (config.themes as Record<string, unknown>[]) : [];
  const globalRefs = Array.isArray(config.reference_accounts) ? (config.reference_accounts as string[]) : [];
  const themes = raw
    .filter((t) => t && (t.subject || t.name))
    .map((t) => ({
      name: String(t.name || t.subject),
      subject: String(t.subject || t.name),
      visual_format: t.visual_format ? String(t.visual_format) : undefined,
      reference_accounts: Array.isArray(t.reference_accounts) && t.reference_accounts.length
        ? (t.reference_accounts as string[]) : globalRefs,
      tone: t.tone ? String(t.tone) : undefined,
      days: Array.isArray(t.days) ? (t.days as number[]) : undefined,
      content_types: Array.isArray(t.content_types) ? (t.content_types as string[]) : undefined,
    }));
  if (themes.length) return themes;
  const topics = (config.research_topics as string[]) || [];
  if (topics.length) return topics.map((t) => ({ name: t, subject: t, reference_accounts: globalRefs }));
  return [{ name: "Geral", subject: "novidades e conteúdo relevante da área", reference_accounts: globalRefs }];
}

// Atribui um tema a cada slot, respeitando theme.days quando definido,
// com rodízio entre os temas candidatos àquele dia.
export function assignThemesToSlots(slots: Slot[], themes: AutopilotTheme[]): AutopilotTheme[] {
  const counters: Record<string, number> = {};
  return slots.map((slot) => {
    let candidates = themes.filter((t) => (t.days?.length ? t.days.includes(slot.dow) : true));
    if (!candidates.length) candidates = themes;
    const key = candidates.map((c) => c.name).join("|");
    const i = counters[key] ?? 0;
    counters[key] = i + 1;
    return candidates[i % candidates.length];
  });
}

// ─── Action: Generate ───────────────────────────────────────────

async function handleGenerate(configId: string, userId?: string) {
  const sb = supabaseAdmin();

  // Load config
  const { data: config, error: cfgErr } = await sb
    .from("autopilot_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (cfgErr || !config) throw new Error(`Config not found: ${cfgErr?.message}`);

  const effectiveUserId = userId || config.user_id;

  // Load brand profile
  let brand: BrandRow | null = null;
  if (config.brand_id) {
    const { data } = await sb
      .from("brand_profiles")
      .select("*")
      .eq("id", config.brand_id)
      .single();
    brand = data;
  }

  // Load user keys (firecrawl + apify p/ referências de IG)
  const { data: userCfg } = await sb
    .from("user_configs")
    .select("firecrawl_api_key, apify_api_token")
    .eq("user_id", effectiveUserId)
    .single();

  const firecrawlKey = userCfg?.firecrawl_api_key;
  const apifyToken = userCfg?.apify_api_token;

  // Temas (motivos complementares) — cai p/ research_topics se não houver temas.
  const themes = normalizeThemes(config);
  const timesPerDay = (config.preferred_times || ["09:00", "18:00"]).length || 1;

  // 1. Pesquisa: scrape global (research_urls) + busca por assunto de cada tema +
  //    legendas de @ de referência (cache por chave p/ não repetir chamadas).
  const allResults: { url: string; title: string; markdown: string }[] = [];
  const subjectCtx: Record<string, string> = {};
  const igCtx: Record<string, string> = {};

  let globalContext = "";
  if (firecrawlKey && config.research_urls?.length) {
    for (const url of config.research_urls) {
      const scraped = await firecrawlScrape(firecrawlKey, url);
      if (scraped) { allResults.push(scraped); }
    }
    globalContext = allResults.map((r) => `## ${r.title}\n${r.markdown?.slice(0, 400) || ""}`).join("\n\n");
  }

  for (const theme of themes) {
    // pesquisa do assunto (dedupe por subject)
    if (firecrawlKey && !(theme.subject in subjectCtx)) {
      const results = await firecrawlSearch(firecrawlKey, theme.subject, 3);
      for (const r of results) allResults.push(r);
      subjectCtx[theme.subject] = results.map((r) => `## ${r.title}\n${r.markdown?.slice(0, 400) || ""}`).join("\n\n");
    }
    // referência de Instagram (dedupe pela lista de handles)
    const refKey = (theme.reference_accounts || []).slice().sort().join(",");
    if (apifyToken && refKey && !(refKey in igCtx)) {
      igCtx[refKey] = await fetchIgReferenceContext(apifyToken, theme.reference_accounts);
    }
  }

  console.log(`[autopilot] ${themes.length} temas, ${allResults.length} resultados de pesquisa`);

  // 2. Cria calendário
  const range = cycleRange(config.recurrence, config.posts_per_cycle, timesPerDay);
  const { data: calendar, error: calErr } = await sb
    .from("autopilot_calendars")
    .insert({
      user_id: effectiveUserId,
      config_id: configId,
      cycle_start: range.start,
      cycle_end: range.end,
      status: config.requires_approval ? "draft" : "approved",
      research_results: allResults.map((r) => ({ url: r.url, title: r.title, summary: r.markdown?.slice(0, 500) || "" })),
    })
    .select()
    .single();

  if (calErr || !calendar) throw new Error(`Failed to create calendar: ${calErr?.message}`);

  // 3. Slots + atribuição de temas (respeita theme.days quando definido)
  const slots = computeSlots(
    config.posts_per_cycle,
    config.preferred_days || [1, 3, 5],
    config.preferred_times || ["09:00", "18:00"],
    config.recurrence,
    config.timezone
  );
  const slotThemes = assignThemesToSlots(slots, themes);

  const platforms = config.platforms || ["instagram"];
  const posts: Record<string, unknown>[] = [];

  // 🔴 Este laço era SERIAL: um `await generatePostContent()` por slot, cada um batendo na
  // edge de IA. Com 5 slots, as chamadas somavam mais que os 150s de limite da edge e o
  // usuário recebia `504 IDLE_TIMEOUT` com apenas o primeiro post gerado.
  //
  // Agora roda com POOL LIMITADO em vez de tudo de uma vez: paralelismo total em N slots
  // dispararia N chamadas de IA simultâneas e convidaria rate limit do provedor. O pool
  // mantém o ganho de tempo sem trocar um erro por outro.
  //
  // A ORDEM é preservada porque cada resultado é gravado em `resultados[i]`, não empilhado
  // na ordem em que termina — `posts` continua casando slot a slot com `slots[i]`.
  const CONCORRENCIA = 3;
  const resultados: (Record<string, unknown> | undefined)[] = new Array(slots.length);

  async function gerarSlot(i: number): Promise<void> {
    const platform = platforms[i % platforms.length];
    const theme = slotThemes[i];
    const topic = theme.subject || brand?.name || "conteúdo";
    const fmt = theme.visual_format || config.visual_format;
    const tone = theme.tone || config.tone || undefined;
    const contentTypes = theme.content_types || config.content_types;
    const refKey = (theme.reference_accounts || []).slice().sort().join(",");
    const researchContext = [globalContext, subjectCtx[theme.subject] || "", igCtx[refKey] || ""]
      .filter(Boolean).join("\n\n");

    try {
      console.log(`[autopilot] Post ${i + 1}/${slots.length} — tema "${theme.name}" (${platform})`);
      const content = await generatePostContent(platform, topic, researchContext, brand, fmt, contentTypes, tone);
      resultados[i] = {
        user_id: effectiveUserId,
        calendar_id: calendar.id,
        platform,
        text_content: content.text,
        hashtags: content.hashtags || [],
        carousel_data: content.carousel || null,
        scheduled_at: slots[i].at.toISOString(),
        status: config.requires_approval ? "draft" : "approved",
        source_topic: topic,
        theme_name: theme.name,
        visual_format: fmt,
      };
    } catch (err) {
      console.error(`[autopilot] Falha no post ${i + 1}:`, err);
      resultados[i] = {
        user_id: effectiveUserId,
        calendar_id: calendar.id,
        platform,
        text_content: `[Erro na geração] ${topic}`,
        hashtags: [],
        scheduled_at: slots[i].at.toISOString(),
        status: "failed",
        error_message: err instanceof Error ? err.message : "Erro desconhecido",
        source_topic: topic,
        theme_name: theme.name,
        visual_format: fmt,
      };
    }
  }

  // Pool: cada "trabalhador" puxa o próximo índice livre até acabarem os slots.
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(CONCORRENCIA, slots.length) },
    async () => {
      while (true) {
        const i = proximo++;
        if (i >= slots.length) return;
        await gerarSlot(i);
      }
    },
  );
  await Promise.all(trabalhadores);

  for (const r of resultados) if (r) posts.push(r);

  if (posts.length > 0) {
    const { error: insertErr } = await sb.from("autopilot_posts").insert(posts);
    if (insertErr) console.error("[autopilot] Insert posts error:", insertErr.message);
  }

  // 4. Atualiza config (próximo ciclo conforme recorrência)
  await sb
    .from("autopilot_configs")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: computeNextRun(config.recurrence, config.posts_per_cycle, timesPerDay).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", configId);

  return {
    calendar_id: calendar.id,
    posts_generated: posts.length,
    research_results: allResults.length,
  };
}

// ─── Action: Generate Visuals ───────────────────────────────────
// A peça visual é ETAPA DO CICLO (Ideias → Geradas), não do agendamento.
//
// Roda em LOTES de propósito: cada imagem gpt-image-2 leva ~17s e um ciclo de
// 5–14 posts estouraria o wall-clock da edge function num único request. Quem
// chama repete a ação enquanto `remaining > 0` (o cliente faz isso em loop; o
// cron pega o resto no tick seguinte). Também respeita o rate-limit de 8/min
// por usuário do social_openai-image.

const VISUAL_BATCH_SIZE = 4;

// Falha de visual vira ESTADO VISÍVEL no quadro — nunca um post que atravessa
// a esteira sem arte.
async function markPostFailed(
  sb: ReturnType<typeof supabaseAdmin>,
  postId: string,
  message: string
) {
  await sb.from("autopilot_posts").update({
    status: "failed",
    error_message: message.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq("id", postId);
}

async function handleGenerateVisuals(
  calendarId: string,
  authHeader?: string,
  postId?: string,
  retryFailed = false
) {
  const sb = supabaseAdmin();

  const { data: calendar } = await sb
    .from("autopilot_calendars")
    .select("config_id")
    .eq("id", calendarId)
    .single();

  const { data: config } = await sb
    .from("autopilot_configs")
    .select("visual_format, brand_id, requires_approval")
    .eq("id", calendar?.config_id)
    .single();

  // Posts que ainda não têm arte: rascunho (fluxo manual) e aprovado sem mídia
  // (full-auto, ciclos antigos, "Regerar visual"). `failed` entra só em
  // RETENTATIVA EXPLÍCITA (botão/post específico) — se entrasse na varredura
  // automática, o que falha seria retentado em loop pelo cron, de hora em hora.
  const statuses = retryFailed || postId
    ? ["draft", "approved", "failed"]
    : ["draft", "approved"];
  let q = sb
    .from("autopilot_posts")
    .select("*")
    .eq("calendar_id", calendarId)
    .in("status", statuses)
    .is("pfm_post_id", null);
  if (postId) q = q.eq("id", postId);
  const { data: allPosts } = await q.order("scheduled_at", { ascending: true });

  const pending = (allPosts || []).filter(
    (p) => !p.media_urls?.length && !p.visual_creation_id
  );
  if (!pending.length) {
    return { generated: 0, failed: 0, pending_visuals: 0, remaining: 0 };
  }

  let brandRow: BrandRow | null = null;
  if (config?.brand_id) {
    const { data } = await sb.from("brand_profiles").select("*").eq("id", config.brand_id).single();
    brandRow = data;
  }

  const cfgFmt = config?.visual_format || "none";
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  // social_openai-image herda verify_jwt=true do default do Supabase (não está no
  // config.toml). O código dela NÃO chama getUser — só valida a JWT na borda.
  // Edge→edge usa SERVICE ROLE (mesmo padrão de social_postforme-proxy).
  // callerAuth segue só para Veo (social_veo-generate tem verify_jwt=false).
  const callerAuth = authHeader || `Bearer ${anon}`;
  // Sem JWT de usuário (chamada do cron) a arte por IMAGEM não tem como sair:
  // social_openai-image resolve `getUser(req)` e cobra rate-limit por user.id.
  // Preferimos falhar com motivo LEGÍVEL a queimar um 401 que ninguém decifra.
  const semUsuario = !authHeader;
  // Arte pronta: fluxo com aprovação → para em "Geradas" esperando o humano;
  // full-auto → já entra aprovado (mesma regra do insert em handleGenerate).
  const readyStatus = config?.requires_approval === false ? "approved" : "visual_ready";

  const batch = pending.slice(0, VISUAL_BATCH_SIZE);
  let generated = 0;
  let failed = 0;
  let pendingVisuals = 0;

  for (const post of batch) {
    const fmt = post.visual_format || cfgFmt;

    // Sem formato visual: o post já está pronto para aprovação — não pode ficar
    // preso em "Ideias" só porque não há arte a gerar.
    if (fmt === "none") {
      await sb.from("autopilot_posts").update({
        status: readyStatus, updated_at: new Date().toISOString(),
      }).eq("id", post.id);
      generated++;
      continue;
    }

    // Marca ANTES de chamar o provider → o post já aparece em "Geradas".
    await sb.from("autopilot_posts").update({
      status: "generating_visual", error_message: null, updated_at: new Date().toISOString(),
    }).eq("id", post.id);

    // ── VÍDEO via Gemini Veo 3.1 (assíncrono → polling em check_visuals) ──
    if (fmt === "video") {
      try {
        const prompt = [
          brandVideoDirective(brandRow),
          post.source_topic ? `Tema: ${post.source_topic}.` : "",
          post.text_content.slice(0, 600),
          brandVoiceDirective(brandRow),
        ].filter(Boolean).join("\n\n");

        const r = await fetch(`${SUPABASE_URL}/functions/v1/social_veo-generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anon, Authorization: callerAuth },
          body: JSON.stringify({
            tool: "veo_text_to_video_direct",
            args: { model: "google/veo-3.1", prompt, duration: 8, with_audio: true, audio_language: "pt-BR" },
          }),
        });

        if (!r.ok) {
          await markPostFailed(sb, post.id, `Vídeo (Veo) ${r.status}: ${(await r.text()).slice(0, 200)}`);
          failed++;
          continue;
        }
        const v = await r.json();
        if (!v.request_id) {
          await markPostFailed(sb, post.id, "Vídeo (Veo): resposta sem request_id.");
          failed++;
          continue;
        }
        await sb.from("autopilot_posts").update({
          status: "generating_visual",
          visual_creation_id: v.request_id,
          visual_provider: "veo",
          updated_at: new Date().toISOString(),
        }).eq("id", post.id);
        pendingVisuals++;
      } catch (e) {
        await markPostFailed(sb, post.id, `Vídeo (Veo): ${e instanceof Error ? e.message : String(e)}`);
        failed++;
      }
      continue;
    }

    // ── IMAGEM via OpenAI gpt-image-2 (síncrono — anexa media_urls na hora) ──
    // Arte 100% gpt-image-2: o estilo (carrossel/infográfico/etc) vai no prompt.
    try {
      const styleHint = fmt === "carousel" ? "estilo carrossel, slide único com destaque"
        : fmt === "infographic" ? "estilo infográfico limpo com hierarquia visual"
        : "card de redes sociais com o texto em destaque";
      const prompt = [
        brandImageDirective(brandRow),
        `Crie uma arte para redes sociais (${styleHint}).`,
        post.source_topic ? `Tema central: ${post.source_topic}.` : "",
        `Texto/tema: ${post.text_content.slice(0, 300)}`,
        "Composição profissional e original, pronta para publicação.",
      ].filter(Boolean).join("\n\n");

      // 🔴 REPASSA a JWT do chamador — service_role NÃO serve aqui.
      //
      // O comentário anterior dizia "espelha social_postforme-proxy" e mandava
      // service_role. Errado por dois motivos, os dois medidos contra o que está
      // DEPLOYADO (o repo está atrás do que roda — ver `openai-image/index.ts`):
      //   1. `social_postforme-proxy` tem verify_jwt=FALSE, então o gateway nem
      //      olha as credenciais dela; `social_openai-image` tem verify_jwt=TRUE.
      //      Com apikey=anon + Authorization=service_role o gateway recusa antes
      //      da função: 401 {"message":"Conflicting API keys"}.
      //   2. Mesmo passando o gateway, a função deployada faz
      //      `const user = await getUser(req); if (!user) 401 "Não autorizado"`
      //      e aplica rate-limit por `user.id`. service_role não é usuário.
      // Por isso o par correto é o mesmo do ramo do Veo: apikey=anon +
      // Authorization = JWT do usuário que clicou.
      if (semUsuario) {
        await markPostFailed(
          sb,
          post.id,
          "Arte por imagem exige a sessão de um usuário (o gerador cobra rate-limit por pessoa). " +
          "Abra o Autopilot e use 'Gerar peças'; o robô de hora em hora não consegue gerar imagem sozinho.",
        );
        failed++;
        continue;
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/social_openai-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: callerAuth,
        },
        body: JSON.stringify({ prompt, size: "1024x1536", quality: "medium", n: 1 }),
      });

      if (!r.ok) {
        const errText = (await r.text()).slice(0, 200);
        await markPostFailed(sb, post.id, `Imagem ${r.status}: ${errText}`);
        failed++;
        continue;
      }

      const data = await r.json();
      const dataUrl = data.images?.[0];
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
        await markPostFailed(sb, post.id, "O provider de imagem não devolveu nenhuma arte.");
        failed++;
        continue;
      }

      const url = await uploadDataUrl(sb, post.user_id, dataUrl);
      if (!url) {
        await markPostFailed(sb, post.id, "Falha ao salvar a arte no storage (bucket media).");
        failed++;
        continue;
      }

      await sb.from("autopilot_posts").update({
        status: readyStatus,
        media_urls: [url],
        visual_provider: "openai",
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", post.id);
      generated++;
    } catch (e) {
      await markPostFailed(sb, post.id, `Imagem: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  return {
    generated,
    failed,
    pending_visuals: pendingVisuals,
    remaining: pending.length - batch.length,
  };
}

// ─── Action: Schedule ───────────────────────────────────────────

async function handleSchedule(calendarId: string) {
  const sb = supabaseAdmin();

  // Só posts APROVADOS. `visual_ready` (arte pronta, aprovação pendente) NÃO
  // entra aqui: agendar de lá fabricaria uma aprovação que ninguém deu.
  const { data: posts, error } = await sb
    .from("autopilot_posts")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("status", "approved")
    .is("pfm_post_id", null);

  if (error || !posts?.length) {
    return { scheduled: 0, message: "Nenhum post para agendar" };
  }

  // Load user config for PFM key
  const userId = posts[0].user_id;
  const { data: userCfg } = await sb
    .from("user_configs")
    .select("postforme_api_key")
    .eq("user_id", userId)
    .single();

  const pfmKey = userCfg?.postforme_api_key;
  if (!pfmKey) throw new Error("PostForMe API key não configurada");

  // Load autopilot config for social_account_ids
  const { data: calendar } = await sb
    .from("autopilot_calendars")
    .select("config_id")
    .eq("id", calendarId)
    .single();

  const { data: config } = await sb
    .from("autopilot_configs")
    .select("social_account_ids, visual_format")
    .eq("id", calendar?.config_id)
    .single();

  const cfgFmt = config?.visual_format || "none";

  let scheduled = 0;
  let skippedNoVisual = 0;

  for (const post of posts) {
    try {
      // Formato por POST (definido pelo tema), com fallback no config.
      const fmt = post.visual_format || cfgFmt;

      // O visual agora nasce em `generate_visuals`. Aqui fica só a trava
      // defensiva: post sem arte NÃO é agendado — e não em silêncio.
      if (fmt !== "none" && !post.media_urls?.length) {
        await sb
          .from("autopilot_posts")
          .update({
            error_message: "Post sem peça visual — gere o visual antes de agendar.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);
        skippedNoVisual++;
        continue;
      }

      // Schedule via PFM proxy
      const pfmPayload = {
        tool: "pfm_create_post",
        args: {
          caption: post.text_content + (post.hashtags?.length ? "\n\n" + post.hashtags.map((h: string) => `#${h}`).join(" ") : ""),
          social_accounts: config?.social_account_ids || [],
          media: post.media_urls || [],
          scheduled_at: post.scheduled_at,
        },
      };

      const res = await fetch(`${SUPABASE_URL}/functions/v1/social_postforme-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pfm-api-key": pfmKey,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
        body: JSON.stringify(pfmPayload),
      });

      if (res.ok) {
        const result = await res.json();
        const pfmPostId = result?.data?.id || result?.id || null;

        await sb
          .from("autopilot_posts")
          .update({
            status: "scheduled",
            pfm_post_id: pfmPostId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);

        scheduled++;
      } else {
        const errText = await res.text();
        await sb
          .from("autopilot_posts")
          .update({
            status: "failed",
            error_message: `PFM ${res.status}: ${errText}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);
      }
    } catch (err) {
      console.error(`[autopilot] Schedule post ${post.id} failed:`, err);
    }
  }

  // Ainda há visual assíncrono (vídeo) em produção neste ciclo? Mantém o
  // calendário em "scheduling" para o cron continuar o polling (check_visuals).
  const { count: pendingVisuals } = await sb
    .from("autopilot_posts")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .eq("status", "generating_visual");

  // Update calendar status
  if (pendingVisuals && pendingVisuals > 0) {
    await sb
      .from("autopilot_calendars")
      .update({ status: "scheduling", updated_at: new Date().toISOString() })
      .eq("id", calendarId);
  } else if (scheduled > 0) {
    // All posts scheduled — mark as "active"
    await sb
      .from("autopilot_calendars")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", calendarId);
  }

  return { scheduled, pending_visuals: pendingVisuals ?? 0, skipped_no_visual: skippedNoVisual };
}

// ─── Action: Check Visuals ──────────────────────────────────────

async function handleCheckVisuals(calendarId: string, authHeader?: string) {
  const sb = supabaseAdmin();

  const { data: posts } = await sb
    .from("autopilot_posts")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("status", "generating_visual");

  if (!posts?.length) return { checked: 0 };

  // Mesma regra de handleGenerateVisuals: com aprovação, a arte pronta para em
  // "Geradas" esperando o humano; em full-auto já entra aprovada.
  const { data: calendar } = await sb
    .from("autopilot_calendars").select("config_id").eq("id", calendarId).single();
  const { data: config } = await sb
    .from("autopilot_configs").select("requires_approval").eq("id", calendar?.config_id).single();
  const readyStatus = config?.requires_approval === false ? "approved" : "visual_ready";

  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerAuth = authHeader || `Bearer ${anon}`;
  // Cron de check_visuals roda de HORA em HORA (`0 * * * *`). Timeout de 15 min
  // matava vídeo pago (Veo pronto em ~3 min) antes do poller olhar: gera 10:05 →
  // entrega 10:08 → cron 11:00 → já falhou. 2h cobre ≥1 tick completo do cron.
  // Além disso, o status do provider é consultado ANTES do timeout — se o Veo
  // já entregou, a peça é salva mesmo que a idade tenha passado do teto.
  const VISUAL_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 h
  const nowMs = Date.now();
  let updated = 0;

  for (const post of posts) {
    const ageMs = post.updated_at ? nowMs - new Date(post.updated_at).getTime() : 0;

    // Sem creation_id não dá pra consultar o provider — só o timeout destrava.
    if (!post.visual_creation_id) {
      if (ageMs > VISUAL_MAX_AGE_MS) {
        await sb.from("autopilot_posts").update({
          status: "failed", visual_creation_id: null,
          error_message: "Visual demorou demais e foi cancelado.",
          updated_at: new Date().toISOString(),
        }).eq("id", post.id);
        updated++;
      }
      continue;
    }

    // Único provider assíncrono é o Gemini Veo 3.1. A imagem OpenAI é síncrona:
    // passa por "generating_visual" dentro de generate_visuals e sai de lá já
    // resolvida (visual_ready/approved ou failed) — nunca chega aqui com
    // visual_creation_id. Qualquer outro provider é resíduo legado → timeout só.
    if (post.visual_provider !== "veo") {
      if (ageMs > VISUAL_MAX_AGE_MS) {
        await sb.from("autopilot_posts").update({
          status: "failed", visual_creation_id: null,
          error_message: "Visual demorou demais e foi cancelado.",
          updated_at: new Date().toISOString(),
        }).eq("id", post.id);
        updated++;
      }
      continue;
    }

    // 1) Consulta o Veo ANTES de aplicar timeout — salva a peça se já estiver pronta.
    try {
      let mediaUrls: string[] | null = null;
      let failed: string | null = null;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/social_veo-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", apikey: anon, Authorization: callerAuth,
        },
        body: JSON.stringify({ tool: "veo_status", args: { request_id: post.visual_creation_id } }),
      });
      if (res.ok) {
        const st = await res.json();
        if (st.status === "completed" && st.video?.url) mediaUrls = [st.video.url];
        else if (st.status === "failed" || st.status === "nsfw") failed = st.error || "Vídeo falhou";
      }

      if (mediaUrls) {
        await sb.from("autopilot_posts").update({
          status: readyStatus, media_urls: mediaUrls, error_message: null,
          updated_at: new Date().toISOString(),
        }).eq("id", post.id);
        updated++;
        continue;
      }
      if (failed !== null) {
        await sb.from("autopilot_posts").update({
          status: "failed", error_message: `Visual falhou: ${failed}`,
          updated_at: new Date().toISOString(),
        }).eq("id", post.id);
        updated++;
        continue;
      }
    } catch (err) {
      console.error(`[autopilot] Check visual for post ${post.id}:`, err);
    }

    // 2) Ainda pendente: só então aplica o timeout de segurança.
    if (ageMs > VISUAL_MAX_AGE_MS) {
      await sb.from("autopilot_posts").update({
        status: "failed", visual_creation_id: null,
        error_message: "Visual demorou demais e foi cancelado.",
        updated_at: new Date().toISOString(),
      }).eq("id", post.id);
      updated++;
    }
  }

  // Sem mais visuais pendentes → destrava o calendário que estava "scheduling"
  // (fecha o ciclo gerar→agendar). O update é restrito a "scheduling" de
  // propósito: um calendário ainda em "draft" não vira "approved" porque um
  // vídeo terminou — aprovar é ato de gente, não efeito colateral de polling.
  const { count: stillPending } = await sb
    .from("autopilot_posts")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .eq("status", "generating_visual");
  if (!stillPending) {
    await sb
      .from("autopilot_calendars")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", calendarId)
      .eq("status", "scheduling");
  }

  return { checked: posts.length, updated };
}

// ─── Action: Confirm Publication ─────────────────────────────────
// Polling PFM pra confirmar publicação real (scheduled → published).

async function handleConfirm(calendarId: string) {
  const sb = supabaseAdmin();
  const { data: posts } = await sb
    .from("autopilot_posts")
    .select("id, pfm_post_id, user_id, platform")
    .eq("calendar_id", calendarId)
    .eq("status", "scheduled");

  if (!posts?.length) return { confirmed: 0 };

  const userId = posts[0].user_id;
  const { data: userCfg } = await sb.from("user_configs").select("postforme_api_key").eq("user_id", userId).single();
  const pfmKey = userCfg?.postforme_api_key;
  if (!pfmKey) return { confirmed: 0, error: "PFM key not found" };

  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  let confirmed = 0;

  // Busca posts recentes processados no PFM
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/social_postforme-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pfm-api-key": pfmKey, apikey: anon, Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
      body: JSON.stringify({ tool: "pfm_list_posts", args: { status: "processed", limit: 50 } }),
    });
    if (!res.ok) return { confirmed: 0, error: `PFM ${res.status}` };

    const pfmData = await res.json();
    const processed = pfmData?.data || [];
    const pfmIds = new Set(processed.map((p: { id?: string }) => p.id).filter(Boolean));

    for (const post of posts) {
      if (post.pfm_post_id && pfmIds.has(post.pfm_post_id)) {
        // Busca URL e engagement do post publicado
        const pfmPost = processed.find((p: { id: string }) => p.id === post.pfm_post_id);
        const platformUrl = pfmPost?.platform_url || pfmPost?.results?.[0]?.platform_url || null;
        const engagement = pfmPost?.results?.[0]?.engagement || null;

        await sb.from("autopilot_posts").update({
          status: "published",
          updated_at: new Date().toISOString(),
          // Armazenamos engagement e URL nos campos existentes (source_url para a URL publicada)
          source_url: platformUrl,
          error_message: engagement ? JSON.stringify(engagement) : null,
        }).eq("id", post.id);
        confirmed++;
      }
    }

    // Se todos confirmados, marca calendário como 'completed'
    const { count: stillScheduled } = await sb
      .from("autopilot_posts")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .eq("status", "scheduled");
    if (!stillScheduled) {
      await sb.from("autopilot_calendars")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", calendarId);
    }
  } catch (e) {
    console.error("[autopilot] confirm error:", e instanceof Error ? e.message : e);
  }

  return { confirmed };
}

// ─── Action: Curate (quality gate + scoring) ────────────────────
// Analisa com IA os posts que JÁ TÊM ARTE (visual_ready) e os aprova; reescreve
// o texto dos que não passam. Roda DEPOIS do visual porque, na esteira nova,
// "approved" significa "aprovado com a arte na frente" — e porque este curador
// nunca rejeita (aprova ou reescreve-e-aprova), então curar antes não economiza
// nenhuma geração de imagem.

async function handleCurate(calendarId: string) {
  const sb = supabaseAdmin();
  const { data: posts } = await sb
    .from("autopilot_posts")
    .select("id, text_content, platform, hashtags, user_id, calendar_id")
    .eq("calendar_id", calendarId)
    .eq("status", "visual_ready");

  if (!posts?.length) return { curated: 0 };

  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("GEMINI_API_KEY");
  if (!lovableKey) return { curated: 0, error: "GEMINI_API_KEY not set" };

  let approved = 0;
  let rewritten = 0;

  for (const post of posts) {
    try {
      // IA avalia: passa (approve) ou reescreve (melhora e aprova)
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          messages: [
            { role: "system", content: `Você é curador de conteúdo. Avalie o post para ${post.platform}. Se estiver BOM (claro, engajador, sem erros, comprimento adequado), responda {"action":"approve"}. Se puder MELHORAR, reescreva e responda {"action":"rewrite","text":"<texto melhorado>"}. Responda APENAS JSON.` },
            { role: "user", content: post.text_content },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const verdict = JSON.parse(cleaned);
        if (verdict.action === "rewrite" && verdict.text) {
          await sb.from("autopilot_posts").update({
            text_content: verdict.text,
            status: "approved",
            updated_at: new Date().toISOString(),
          }).eq("id", post.id);
          rewritten++;
        } else {
          await sb.from("autopilot_posts").update({
            status: "approved",
            updated_at: new Date().toISOString(),
          }).eq("id", post.id);
          approved++;
        }
      } catch {
        // Não conseguiu parsear → aprova como está
        await sb.from("autopilot_posts").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", post.id);
        approved++;
      }
    } catch (e) {
      console.error(`[autopilot] curate post ${post.id}:`, e instanceof Error ? e.message : e);
    }
  }

  // Só marca o calendário como approved quando NADA mais está a caminho —
  // nem texto (draft), nem arte (generating_visual/visual_ready).
  const { count: stillDraft } = await sb
    .from("autopilot_posts")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .in("status", ["draft", "generating_visual", "visual_ready"]);
  if (!stillDraft) {
    await sb.from("autopilot_calendars")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", calendarId);
  }

  return { curated: approved + rewritten, approved, rewritten };
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const { action, config_id, calendar_id, post_id, retry_failed } = await req.json();

    if (!action) {
      return errorResponse("Missing 'action'", 400);
    }

    // Extract user ID from auth header if present
    const authHeader = req.headers.get("authorization");
    let userId: string | undefined;
    if (authHeader) {
      const sb = supabaseForUser(authHeader);
      const { data: { user } } = await sb.auth.getUser();
      userId = user?.id;
    }

    switch (action) {
      case "generate": {
        if (!config_id) return errorResponse("Missing 'config_id'", 400);
        const result = await handleGenerate(config_id, userId);
        return jsonResponse(result);
      }
      case "generate_visuals": {
        if (!calendar_id) return errorResponse("Missing 'calendar_id'", 400);
        // social_openai-image é chamada com SERVICE ROLE (edge→edge).
        // authHeader só é repassado ao Veo (vídeo assíncrono).
        const result = await handleGenerateVisuals(calendar_id, authHeader ?? undefined, post_id, retry_failed === true);
        return jsonResponse(result);
      }
      case "schedule": {
        if (!calendar_id) return errorResponse("Missing 'calendar_id'", 400);
        const result = await handleSchedule(calendar_id);
        return jsonResponse(result);
      }
      case "check_visuals": {
        if (!calendar_id) return errorResponse("Missing 'calendar_id'", 400);
        const result = await handleCheckVisuals(calendar_id, authHeader ?? undefined);
        return jsonResponse(result);
      }
      case "confirm": {
        if (!calendar_id) return errorResponse("Missing 'calendar_id'", 400);
        const result = await handleConfirm(calendar_id);
        return jsonResponse(result);
      }
      case "curate": {
        if (!calendar_id) return errorResponse("Missing 'calendar_id'", 400);
        const result = await handleCurate(calendar_id);
        return jsonResponse(result);
      }
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[autopilot-run] Error:", message);
    return errorResponse(message, 502);
  }
});
