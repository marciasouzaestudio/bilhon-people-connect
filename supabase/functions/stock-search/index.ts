import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Stock Image Search — banco de imagens REAL (fotos de acervo, não geração por IA).
 *
 * Desde 29/10/2026 (card 17tr6jh5gqv): o fornecedor é o Pixabay, com a chave da
 * PLATAFORMA (secret PIXABAY_API_KEY). O Pexels pausou a emissão de chaves novas
 * ("New API key issuance is currently paused", pexels.com/api) e o central nunca
 * teve chave dele: a busca só funcionava para quem já tinha chave própria (10 de 66
 * clientes em 29/10). Quem entrava depois ficava sem banco de imagens.
 *
 * Regras do Pixabay (pixabay.com/api/docs) que este arquivo segue:
 * - busca guardada por 24 h (aqui, um JSON por busca no bucket `media`, em stock/cache/);
 * - o link da imagem do Pixabay é TEMPORÁRIO (webformatURL vale 24 h) e não pode ser
 *   usado para sempre: a miniatura da grade usa o link dele, mas a imagem escolhida
 *   (url/fullUrl) aponta para social_stock-image, que copia a foto para o nosso bucket
 *   na primeira vez e depois só redireciona;
 * - mostrar a origem: `source: "pixabay"` e o autor em cada resultado.
 *
 * Chave do Pexels que o cliente salvou (header x-pexels-api-key): deixou de passar por
 * cima da plataforma (comentário do Paulo no card, 28/10). Ela só é usada como reserva,
 * se o Pixabay falhar, e na validação da tela de Configurações (busca "teste", 1 foto),
 * que continua testando a chave do Pexels de verdade.
 *
 * O formato da resposta não mudou: as telas antigas (inclusive remix) seguem iguais.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pexels-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  query: string;
  count?: number;
  orientation?: "landscape" | "portrait" | "squarish";
}

interface StockImage {
  id: string;
  url: string;
  thumbUrl: string;
  fullUrl: string;
  alt: string;
  author: string;
  authorUrl: string;
  source: string;
}

interface PixabayHit {
  id: number;
  tags?: string;
  webformatURL?: string;
  previewURL?: string;
  user?: string;
  user_id?: number;
}

const BUCKET = "media";
const CACHE_PREFIX = "stock/cache/";
const CACHE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 12_000;

class LimiteDoFornecedor extends Error {}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Busca no Pixabay, com a busca guardada por 24 h. Lança LimiteDoFornecedor no 429. */
async function buscarPixabay(chave: string, consulta: string, quantidade: number, orientacao: RequestBody["orientation"]): Promise<StockImage[]> {
  const q = consulta.trim().slice(0, 100); // o Pixabay aceita até 100 caracteres
  const porPagina = Math.min(30, Math.max(3, quantidade)); // o Pixabay exige de 3 a 200
  const orient = orientacao === "landscape" ? "horizontal" : orientacao === "portrait" ? "vertical" : "all";

  const db = admin();
  const caminho = `${CACHE_PREFIX}${await sha256(`${q.toLowerCase()}|${porPagina}|${orient}`)}.json`;

  let hits: PixabayHit[] | null = null;
  try {
    const { data } = await db.storage.from(BUCKET).download(caminho);
    if (data) {
      const guardado = JSON.parse(await data.text());
      if (Date.now() - Number(guardado.fetchedAt || 0) < CACHE_MS) hits = guardado.hits;
    }
  } catch { /* sem busca guardada: segue para o Pixabay */ }

  if (!hits) {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", chave);
    url.searchParams.set("q", q);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("orientation", orient);
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("per_page", String(porPagina));
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) throw new LimiteDoFornecedor("Pixabay 429");
    if (!res.ok) throw new Error(`Pixabay ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const data = await res.json();
    hits = (data.hits || []).map((h: PixabayHit) => ({
      id: h.id, tags: h.tags, webformatURL: h.webformatURL, previewURL: h.previewURL, user: h.user, user_id: h.user_id,
    }));
    const corpo = new Blob([JSON.stringify({ fetchedAt: Date.now(), hits })], { type: "application/json" });
    const { error } = await db.storage.from(BUCKET).upload(caminho, corpo, { upsert: true, contentType: "application/json" });
    if (error) console.warn("[stock-search] não guardou a busca:", error.message);
  }

  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  return (hits || []).slice(0, quantidade).map((h) => {
    const escolhida = `${base}/functions/v1/social_stock-image?id=${h.id}`;
    return {
      id: String(h.id),
      url: escolhida,
      thumbUrl: (h.webformatURL || "").replace("_640", "_340") || h.previewURL || escolhida,
      fullUrl: escolhida,
      alt: h.tags || q,
      author: h.user || "Pixabay",
      authorUrl: h.user && h.user_id ? `https://pixabay.com/users/${h.user}-${h.user_id}/` : "https://pixabay.com",
      source: "pixabay",
    };
  });
}

/** Busca no Pexels com a chave do cliente (reserva e validação). Mesmo pedido de antes. */
async function buscarPexels(chave: string, consulta: string, quantidade: number, orientacao: RequestBody["orientation"]): Promise<Response> {
  const pexelsOrientation = orientacao === "squarish" ? "square" : orientacao;
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", consulta.trim());
  url.searchParams.set("per_page", String(Math.min(quantidade, 30)));
  url.searchParams.set("orientation", pexelsOrientation || "square");
  url.searchParams.set("locale", "pt-BR");

  const res = await fetch(url.toString(), { headers: { Authorization: chave }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[stock-search] Pexels error:", res.status, txt.slice(0, 200));
    const msg = res.status === 401 ? "Chave Pexels inválida." : `Pexels ${res.status}`;
    return json({ error: msg }, res.status === 401 ? 401 : 502);
  }
  const data = await res.json();
  const images: StockImage[] = (data.photos || []).map((p: {
    id: number; alt?: string; photographer?: string; photographer_url?: string;
    src?: { original?: string; large?: string; medium?: string; tiny?: string };
  }) => ({
    id: String(p.id),
    url: p.src?.large || p.src?.medium || p.src?.original || "",
    thumbUrl: p.src?.tiny || p.src?.medium || "",
    fullUrl: p.src?.original || p.src?.large || "",
    alt: p.alt || consulta.trim(),
    author: p.photographer || "Pexels",
    authorUrl: p.photographer_url || "https://www.pexels.com",
    source: "pexels",
  }));
  return json({ images });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { query, count = 12, orientation = "squarish" }: RequestBody = await req.json();
    if (!query?.trim()) return json({ error: "Missing 'query'" }, 400);
    const quantidade = Math.max(1, Math.min(Number(count) || 12, 30));

    const chavePexels = req.headers.get("x-pexels-api-key")?.trim() || "";
    const chavePixabay = Deno.env.get("PIXABAY_API_KEY")?.trim() || "";

    // Validação da chave do Pexels na tela de Configurações (validatePexelsKey manda
    // { query: "teste", count: 1 } com a chave no header): testa o Pexels de verdade.
    if (chavePexels && query.trim().toLowerCase() === "teste" && Number(count) === 1) {
      return await buscarPexels(chavePexels, query, 1, orientation);
    }

    if (chavePixabay) {
      try {
        return json({ images: await buscarPixabay(chavePixabay, query, quantidade, orientation) });
      } catch (e) {
        console.error("[stock-search] Pixabay falhou:", e instanceof Error ? e.message : e);
        if (chavePexels) return await buscarPexels(chavePexels, query, quantidade, orientation);
        return json({
          error: e instanceof LimiteDoFornecedor
            ? "O banco de imagens está com muitas buscas agora. Tente de novo em um minuto."
            : "O banco de imagens não respondeu agora. Tente de novo em instantes.",
        }, 502);
      }
    }

    if (chavePexels) return await buscarPexels(chavePexels, query, quantidade, orientation);
    console.error("[stock-search] PIXABAY_API_KEY não configurada no projeto");
    return json({ error: "Banco de imagens indisponível no momento. Avise o suporte." }, 503);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("stock-search error:", message);
    return json({ error: message }, 502);
  }
});
