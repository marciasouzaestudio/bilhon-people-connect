#!/usr/bin/env node
/**
 * Teste E2E do Autopilot — valida cada etapa do pipeline contra as edge
 * functions REAIS já deployadas (Supabase rajgstqxyprkphuvsmft), usando as
 * suas chaves nos headers. Isola o que passa/falha em cada integração.
 *
 * Uso:
 *   FIRECRAWL_API_KEY=fc-... \
 *   OPENAI_API_KEY=sk-... \           # opcional (senão usa a chave do Vault)
 *   APIFY_API_TOKEN=apify_api_... \   # opcional (referência de Instagram)
 *   IG_REFERENCE=@nasa \              # opcional (conta IG de referência p/ testar)
 *   HIGGSFIELD_API_ID=... HIGGSFIELD_API_SECRET=... \  # opcional (vídeo)
 *   PFM_API_KEY=pfm_live_... \        # publicação (lista contas)
 *   PFM_PUBLISH=1 \                   # opcional: cria 1 post de teste agendado +7 dias
 *   node scripts/autopilot-e2e.mjs
 *
 * Por padrão NÃO publica nada (só lista contas). PFM_PUBLISH=1 agenda 1 post de teste.
 */

const BASE = process.env.SUPABASE_URL || "https://rajgstqxyprkphuvsmft.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamdzdHF4eXBya3BodXZzbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUwMTEsImV4cCI6MjA5MTQyMTAxMX0.NsnYAi8FwECl0XI1CoHOUo6a8wHo-prElzDW0dq9YuE";

const ok = (s) => `\x1b[32m✅ ${s}\x1b[0m`;
const bad = (s) => `\x1b[31m❌ ${s}\x1b[0m`;
const skip = (s) => `\x1b[33m⏭  ${s}\x1b[0m`;
const head = (s) => `\n\x1b[1m\x1b[36m── ${s} ──\x1b[0m`;

const results = [];
const snippet = (v) => JSON.stringify(v).slice(0, 220);

async function fn(name, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

function record(step, pass, detail) {
  results.push({ step, pass });
  console.log(pass ? ok(`${step} — ${detail}`) : bad(`${step} — ${detail}`));
}

// ─────────────────────────────────────────────────────────────────
let researchContext = "";
let generatedImage = "";

async function testFirecrawl() {
  console.log(head("1) Firecrawl — pesquisa (research)"));
  if (!process.env.FIRECRAWL_API_KEY) return console.log(skip("FIRECRAWL_API_KEY ausente — pulando pesquisa"));
  try {
    const r = await fn("firecrawl-search", { query: "tendências de marketing digital 2026", limit: 2 }, { "x-firecrawl-api-key": process.env.FIRECRAWL_API_KEY });
    const items = r.json?.results || [];
    researchContext = items.map((x) => `## ${x.title}\n${(x.markdown || "").slice(0, 400)}`).join("\n\n");
    record("Firecrawl", r.ok && items.length > 0, r.ok ? `${items.length} resultados (ex: "${items[0]?.title || ""}")` : `HTTP ${r.status}: ${snippet(r.json)}`);
  } catch (e) { record("Firecrawl", false, e.message); }
}

async function testGenerateContent() {
  console.log(head("2) generate-content — copy (Lovable AI)"));
  try {
    const r = await fn("generate-content", {
      prompt: "3 dicas de marketing para PMEs",
      platforms: ["instagram"],
      language: "português brasileiro",
      sourceContent: researchContext || undefined,
      brandProfile: { name: "Marca Teste", tone: "descontraído", industry: "marketing" },
    });
    const post = r.json?.posts?.instagram;
    record("generate-content", r.ok && !!post, r.ok ? `copy gerada (${(post || "").length} chars), ${r.json?.hashtags?.length || 0} hashtags` : `HTTP ${r.status}: ${snippet(r.json)}`);
  } catch (e) { record("generate-content", false, e.message); }
}

async function testOpenAiImage() {
  console.log(head("3) openai-image — imagem gpt-image-2"));
  const hdr = process.env.OPENAI_API_KEY ? { "x-openai-api-key": process.env.OPENAI_API_KEY } : {};
  if (!process.env.OPENAI_API_KEY) console.log(skip("OPENAI_API_KEY ausente — testando via chave do Vault da plataforma"));
  try {
    const r = await fn("openai-image", { prompt: "arte minimalista para post de marketing, paleta roxa, sem texto", size: "1024x1536", quality: "medium", n: 1 }, hdr);
    const img = r.json?.images?.[0];
    generatedImage = typeof img === "string" ? img : "";
    record("openai-image", r.ok && !!img, r.ok ? `imagem gerada (${(generatedImage || "").startsWith("data:") ? "base64" : "url"})` : `HTTP ${r.status}: ${snippet(r.json)}`);
  } catch (e) { record("openai-image", false, e.message); }
}

async function testApifyIg() {
  console.log(head("4) social-analytics — referência de Instagram (Apify)"));
  if (!process.env.APIFY_API_TOKEN) return console.log(skip("APIFY_API_TOKEN ausente — pulando referências de IG"));
  const ref = (process.env.IG_REFERENCE || "nasa").replace(/^@/, "");
  try {
    const r = await fn("social-analytics", { accounts: [{ platform: "instagram", username: ref }], enrich: false }, { "x-apify-api-token": process.env.APIFY_API_TOKEN });
    const profiles = Array.isArray(r.json) ? r.json : (r.json?.profiles || r.json?.results || []);
    const caps = profiles[0]?.recentPosts?.filter((p) => p.text)?.length || 0;
    record("social-analytics (IG)", r.ok && profiles.length > 0, r.ok ? `@${ref}: ${caps} legendas recentes capturadas` : `HTTP ${r.status}: ${snippet(r.json)}`);
  } catch (e) { record("social-analytics (IG)", false, e.message); }
}

async function testHiggsfield() {
  console.log(head("5) higgsfield-proxy — vídeo (opcional)"));
  if (!process.env.HIGGSFIELD_API_ID || !process.env.HIGGSFIELD_API_SECRET) return console.log(skip("HIGGSFIELD_API_ID/SECRET ausentes — pulando vídeo"));
  const hdr = { "x-higgsfield-api-id": process.env.HIGGSFIELD_API_ID, "x-higgsfield-api-secret": process.env.HIGGSFIELD_API_SECRET };
  try {
    const model = process.env.VIDEO_MODEL || "kling-video/v2.6/pro/text-to-video";
    const r = await fn("higgsfield-proxy", { tool: "hf_text_to_video_direct", args: { model, prompt: "café sendo servido em câmera lenta, cinematográfico", duration: 5, with_audio: true, audio_language: "pt-BR" } }, hdr);
    const id = r.json?.request_id;
    if (r.ok && id) {
      const st = await fn("higgsfield-proxy", { tool: "hf_status", args: { request_id: id } }, hdr);
      record("higgsfield (vídeo)", true, `request_id ok, status inicial: ${st.json?.status || "?"} (geração leva minutos)`);
    } else {
      record("higgsfield (vídeo)", false, `HTTP ${r.status}: ${snippet(r.json)}`);
    }
  } catch (e) { record("higgsfield (vídeo)", false, e.message); }
}

async function testPfm() {
  console.log(head("6) postforme-proxy — contas + publicação"));
  if (!process.env.PFM_API_KEY) return console.log(skip("PFM_API_KEY ausente — pulando publicação"));
  const hdr = { "x-pfm-api-key": process.env.PFM_API_KEY };
  try {
    const r = await fn("postforme-proxy", { tool: "pfm_list_accounts", args: {} }, hdr);
    const accounts = (r.json?.data || []).filter((a) => a.status !== "disconnected");
    record("PFM contas", r.ok && accounts.length > 0, r.ok ? `${accounts.length} conta(s): ${accounts.map((a) => `${a.platform}:@${a.username || a.name}`).join(", ")}` : `HTTP ${r.status}: ${snippet(r.json)}`);

    if (process.env.PFM_PUBLISH === "1" && accounts.length) {
      const acc = accounts.find((a) => String(a.id) === process.env.PFM_ACCOUNT_ID) || accounts[0];
      const when = new Date(Date.now() + 7 * 86400_000).toISOString();
      const payload = { tool: "pfm_create_post", args: { caption: "🧪 Post de teste do Autopilot (agendado, pode apagar). #teste", social_accounts: [acc.id], scheduled_at: when } };
      if (generatedImage && generatedImage.startsWith("http")) payload.args.media = [{ url: generatedImage }];
      const p = await fn("postforme-proxy", payload, hdr);
      const postId = p.json?.id || p.json?.data?.id;
      record("PFM agendar", p.ok && !!postId, p.ok ? `post agendado p/ +7d em @${acc.username || acc.name} (id ${postId})` : `HTTP ${p.status}: ${snippet(p.json)}`);
      // Apaga o post de teste logo em seguida (não deixar lixo na fila).
      if (process.env.PFM_DELETE_AFTER !== "0" && postId) {
        const d = await fn("postforme-proxy", { tool: "pfm_delete_post", args: { id: postId } }, hdr);
        record("PFM apagar (cleanup)", d.ok, d.ok ? `post de teste ${postId} apagado` : `HTTP ${d.status}: ${snippet(d.json)} — APAGUE MANUALMENTE o post ${postId}`);
      }
    } else {
      console.log(skip("PFM_PUBLISH!=1 — não criei post (apenas listei contas)"));
    }
  } catch (e) { record("PFM", false, e.message); }
}

(async () => {
  console.log(`\n\x1b[1mTESTE E2E — AUTOPILOT\x1b[0m  (alvo: ${BASE})`);
  await testFirecrawl();
  await testGenerateContent();
  await testOpenAiImage();
  await testApifyIg();
  await testHiggsfield();
  await testPfm();

  console.log(head("RESUMO"));
  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`  ${r.pass ? "✅" : "❌"} ${r.step}`);
  console.log(`\n${pass}/${results.length} etapas testadas passaram.${pass === results.length ? " 🎉" : ""}\n`);
  process.exit(results.every((r) => r.pass) ? 0 : 1);
})();
