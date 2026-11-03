#!/usr/bin/env node
/**
 * Debug da geração de vídeo Higgsfield ponta a ponta (igual ao Studio):
 * cria com with_audio=true e imprime o JSON CRU de cada poll de status até
 * completar/falhar — pra descobrir a forma real do resultado (onde vem a URL).
 *
 * HIGGSFIELD_API_ID=... HIGGSFIELD_API_SECRET=... node scripts/higgsfield-debug.mjs
 */
const BASE = process.env.SUPABASE_URL || "https://rajgstqxyprkphuvsmft.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamdzdHF4eXBya3BodXZzbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUwMTEsImV4cCI6MjA5MTQyMTAxMX0.NsnYAi8FwECl0XI1CoHOUo6a8wHo-prElzDW0dq9YuE";
const ID = process.env.HIGGSFIELD_API_ID, SECRET = process.env.HIGGSFIELD_API_SECRET;
if (!ID || !SECRET) { console.error("Defina HIGGSFIELD_API_ID e HIGGSFIELD_API_SECRET"); process.exit(1); }
const hdr = { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, "x-higgsfield-api-id": ID, "x-higgsfield-api-secret": SECRET };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function proxy(tool, args) {
  const r = await fetch(`${BASE}/functions/v1/higgsfield-proxy`, { method: "POST", headers: hdr, body: JSON.stringify({ tool, args }) });
  let j; try { j = JSON.parse(await r.text()); } catch (e) { j = { _parseError: String(e) }; }
  return { status: r.status, ok: r.ok, j };
}

(async () => {
  const model = process.env.VIDEO_MODEL || "kling-video/v2.6/pro/text-to-video";
  console.log(`\nCriando vídeo (${model}, with_audio=true)…`);
  const c = await proxy("hf_text_to_video_direct", { model, prompt: "um café sendo servido em câmera lenta, cinematográfico", duration: 5, with_audio: true, audio_language: "pt-BR" });
  console.log("CREATE →", c.status, JSON.stringify(c.j));
  const id = c.j?.request_id;
  if (!id) { console.log("Sem request_id — abortando."); process.exit(1); }

  for (let i = 1; i <= 30; i++) {
    await sleep(8000);
    const s = await proxy("hf_status", { request_id: id });
    console.log(`\n[poll ${i}] HTTP ${s.status}`);
    console.log(JSON.stringify(s.j, null, 2));
    const st = s.j?.status;
    if (["completed", "succeeded", "success", "done", "failed", "nsfw", "error", "canceled", "cancelled"].includes(String(st))) {
      console.log(`\n>>> Terminou com status="${st}". Veja acima onde está a URL do vídeo.`);
      break;
    }
  }
})();
