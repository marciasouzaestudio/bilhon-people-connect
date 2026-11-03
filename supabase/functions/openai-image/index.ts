import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * OpenAI Image Generation proxy.
 *
 * Resolução da chave (nesta ordem):
 *   1. header `x-openai-api-key` (chave por-usuário, opcional)
 *   2. Supabase Vault via RPC public.get_vault_secret (chave da plataforma)
 *   3. env OPENAI_API_KEY (fallback)
 *
 * A chave nunca trafega no bundle do cliente nem no git.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openai-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Troque para "gpt-image-1" caso a API recuse "gpt-image-2".
const DEFAULT_IMAGE_MODEL = "gpt-image-2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function resolveOpenAiKey(headerKey: string | null): Promise<string | null> {
  if (headerKey?.trim()) return headerKey.trim();
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await admin.rpc("get_vault_secret", { secret_name: "OPENAI_API_KEY" });
    if (!error && typeof data === "string" && data) return data;
  } catch (e) {
    console.error("[openai-image] vault lookup failed:", e instanceof Error ? e.message : e);
  }
  return Deno.env.get("OPENAI_API_KEY") ?? null;
}

interface RequestBody {
  prompt: string;
  size?: string;        // "1024x1024" | "1024x1536" | "1536x1024" | "auto"
  n?: number;
  model?: string;
  quality?: string;     // gpt-image: "low" | "medium" | "high" | "auto"
  background?: string;  // "transparent" | "opaque" | "auto"
}

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
    const body: RequestBody = await req.json();
    const { prompt, size = "1024x1024", n = 1, model, quality, background } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Missing 'prompt'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = await resolveOpenAiKey(req.headers.get("x-openai-api-key"));
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não disponível (Vault/secret) e nenhum x-openai-api-key informado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Edge Functions têm limite de 150s. `quality: "high"` em gpt-image-2
    // costuma estourar esse limite → rebaixamos para "medium" no servidor.
    const safeQuality = quality === "high" ? "medium" : (quality || "medium");

    const payload: Record<string, unknown> = {
      model: model || DEFAULT_IMAGE_MODEL,
      prompt,
      n,
      size,
      quality: safeQuality,
    };
    if (background) payload.background = background;

    console.log(`[openai-image] model=${payload.model} size=${size} n=${n}`);

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[openai-image] OpenAI error:", resp.status, errText);
      let msg = `OpenAI ${resp.status}`;
      try { msg = JSON.parse(errText)?.error?.message || msg; } catch { /* keep raw */ }
      if (resp.status === 401) msg = "Chave OpenAI inválida.";
      if (resp.status === 429) msg = "Limite de taxa ou créditos OpenAI excedido.";
      return new Response(JSON.stringify({ error: msg }), {
        status: resp.status === 401 ? 401 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // gpt-image-* retorna b64_json; dall-e pode retornar url.
    const images: string[] = (data.data || [])
      .map((d: { b64_json?: string; url?: string }) =>
        d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url
      )
      .filter(Boolean);

    return new Response(JSON.stringify({ images, model: payload.model }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("openai-image error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
