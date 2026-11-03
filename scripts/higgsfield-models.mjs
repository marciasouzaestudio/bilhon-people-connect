#!/usr/bin/env node
/**
 * Sonda quais modelos de vídeo do Higgsfield funcionam NA SUA CONTA.
 * Para cada modelo: dispara um text-to-video mínimo via a edge function real
 * (higgsfield-proxy) e CANCELA imediatamente (custo mínimo). Reporta OK/erro.
 *
 * Uso:
 *   HIGGSFIELD_API_ID=... HIGGSFIELD_API_SECRET=... node scripts/higgsfield-models.mjs
 */
const BASE = process.env.SUPABASE_URL || "https://rajgstqxyprkphuvsmft.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamdzdHF4eXBya3BodXZzbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUwMTEsImV4cCI6MjA5MTQyMTAxMX0.NsnYAi8FwECl0XI1CoHOUo6a8wHo-prElzDW0dq9YuE";

const ID = process.env.HIGGSFIELD_API_ID, SECRET = process.env.HIGGSFIELD_API_SECRET;
if (!ID || !SECRET) { console.error("Defina HIGGSFIELD_API_ID e HIGGSFIELD_API_SECRET"); process.exit(1); }
const hdr = { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, "x-higgsfield-api-id": ID, "x-higgsfield-api-secret": SECRET };

// Candidatos a text-to-video (alguns podem exigir allowlist/upgrade).
const MODELS = [
  "kling-video/v2.6/pro/text-to-video",
  "kling-video/v3.0/pro/text-to-video",
  "kling-video/v2.5/pro/text-to-video",
  "veo3/text-to-video",
  "veo3-fast/text-to-video",
  "sora-2/text-to-video",
  "seedance/v1/pro/text-to-video",
];

async function proxy(tool, args) {
  const r = await fetch(`${BASE}/functions/v1/higgsfield-proxy`, { method: "POST", headers: hdr, body: JSON.stringify({ tool, args }) });
  let j; try { j = JSON.parse(await r.text()); } catch { j = {}; }
  return { status: r.status, ok: r.ok, j };
}

(async () => {
  console.log(`\n\x1b[1mSONDA DE MODELOS HIGGSFIELD\x1b[0m (conta via ${BASE})\n`);
  const out = [];
  for (const model of MODELS) {
    process.stdout.write(`• ${model} … `);
    try {
      const r = await proxy("hf_text_to_video_direct", { model, prompt: "teste técnico, paisagem simples", duration: 5, with_audio: false });
      const id = r.j?.request_id;
      if (r.ok && id) {
        console.log("\x1b[32mOK (aceito)\x1b[0m");
        out.push({ model, ok: true, note: "aceito" });
        await proxy("hf_cancel", { request_id: id }); // cancela p/ não gastar
      } else {
        const msg = (r.j?.error || JSON.stringify(r.j)).slice(0, 120);
        console.log(`\x1b[31mERRO ${r.status}\x1b[0m — ${msg}`);
        out.push({ model, ok: false, note: `${r.status}: ${msg}` });
      }
    } catch (e) { console.log(`\x1b[31mEXC\x1b[0m ${e.message}`); out.push({ model, ok: false, note: e.message }); }
  }
  console.log("\n\x1b[1m── RESUMO ──\x1b[0m");
  for (const r of out) console.log(`  ${r.ok ? "✅" : "❌"} ${r.model}${r.ok ? "" : `  (${r.note})`}`);
  const okm = out.filter((r) => r.ok).map((r) => r.model);
  console.log(`\nModelos que funcionam na conta: ${okm.length ? okm.join(", ") : "NENHUM"}\n`);
})();
