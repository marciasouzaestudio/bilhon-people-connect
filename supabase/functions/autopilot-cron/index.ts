import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Autopilot Cron — Disparado periodicamente (pg_cron ou externo)
 *
 * 1. Configs ativas com next_run_at <= agora → "generate" (texto/Ideias)
 * 2. Calendários draft → "generate_visuals" → "check_visuals" → "curate"
 * 3. Calendários aprovados → "check_visuals" → "generate_visuals" → "schedule"
 * 4. Calendários "scheduling" → "check_visuals"
 * 5. Calendários "active" → "confirm"
 *
 * A peça visual é etapa do ciclo (Ideias → Geradas). `social_autopilot-run`
 * chama `social_openai-image` com SERVICE ROLE (verify_jwt=true na borda;
 * a edge de imagem não faz getUser). Full-auto e draft usam o mesmo caminho.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'app_social' } });
}

async function callAutopilotRun(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/social_autopilot-run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const sb = supabaseAdmin();
    const now = new Date().toISOString();
    const results = { generated: 0, visuals_generated: 0, curated: 0, scheduled: 0, visuals_checked: 0, confirmed: 0 };

    // 1. Configs que precisam gerar novo ciclo
    const { data: dueConfigs } = await sb
      .from("autopilot_configs")
      .select("id")
      .eq("is_active", true)
      .lte("next_run_at", now);

    if (dueConfigs?.length) {
      console.log(`[autopilot-cron] ${dueConfigs.length} configs due for generation`);
      for (const config of dueConfigs) {
        const res = await callAutopilotRun({ action: "generate", config_id: config.id });
        if (res.ok) results.generated++;
        else {
          console.error(`[autopilot-cron] Generate failed for ${config.id}: ${res.status}`);
          // Backoff: adia 1h para não re-tentar a cada tick (evita spam de falhas).
          const retryAt = new Date(Date.now() + 3600_000).toISOString();
          await sb.from("autopilot_configs").update({ next_run_at: retryAt }).eq("id", config.id);
        }
      }
    }

    // 2. Calendários draft → gera arte (Ideias → Geradas), fecha Veo pendente,
    //    cura o que já tem visual_ready. generate_visuals roda em lotes de 4;
    //    o restante fica no próximo tick (remaining > 0).
    const { data: draftCalendars } = await sb
      .from("autopilot_calendars")
      .select("id")
      .eq("status", "draft");

    if (draftCalendars?.length) {
      console.log(`[autopilot-cron] ${draftCalendars.length} calendars in draft`);
      for (const cal of draftCalendars) {
        const vis = await callAutopilotRun({ action: "generate_visuals", calendar_id: cal.id });
        if (vis.ok) results.visuals_generated++;
        const chk = await callAutopilotRun({ action: "check_visuals", calendar_id: cal.id });
        if (chk.ok) results.visuals_checked++;
        const cur = await callAutopilotRun({ action: "curate", calendar_id: cal.id });
        if (cur.ok) results.curated++;
      }
    }

    // 3. Calendários aprovados: garante a arte (full-auto insere o post já
    //    aprovado, sem mídia) e só então agenda.
    const { data: approvedCalendars } = await sb
      .from("autopilot_calendars")
      .select("id")
      .eq("status", "approved");

    if (approvedCalendars?.length) {
      console.log(`[autopilot-cron] ${approvedCalendars.length} calendars to schedule`);
      for (const cal of approvedCalendars) {
        const chk = await callAutopilotRun({ action: "check_visuals", calendar_id: cal.id });
        if (chk.ok) results.visuals_checked++;
        const vis = await callAutopilotRun({ action: "generate_visuals", calendar_id: cal.id });
        if (vis.ok) results.visuals_generated++;
        const res = await callAutopilotRun({ action: "schedule", calendar_id: cal.id });
        if (res.ok) results.scheduled++;
      }
    }

    // 3. Calendários com visuais pendentes
    const { data: visualCalendars } = await sb
      .from("autopilot_calendars")
      .select("id")
      .eq("status", "scheduling");

    if (visualCalendars?.length) {
      console.log(`[autopilot-cron] ${visualCalendars.length} calendars with pending visuals`);
      for (const cal of visualCalendars) {
        const res = await callAutopilotRun({ action: "check_visuals", calendar_id: cal.id });
        if (res.ok) results.visuals_checked++;
      }
    }

    // 5. Calendários "active" → confirma publicação real no PFM
    const { data: activeCalendars } = await sb
      .from("autopilot_calendars")
      .select("id")
      .eq("status", "active");

    if (activeCalendars?.length) {
      console.log(`[autopilot-cron] ${activeCalendars.length} calendars to confirm publication`);
      for (const cal of activeCalendars) {
        const res = await callAutopilotRun({ action: "confirm", calendar_id: cal.id });
        if (res.ok) results.confirmed++;
      }
    }

    console.log("[autopilot-cron] Done:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[autopilot-cron] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
