import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Stock Image — a foto do Pixabay que o cliente escolheu, guardada no nosso bucket.
 *
 * Por que existe (card 17tr6jh5gqv, 29/10/2026): o Pixabay não deixa usar o link dele
 * para sempre ("permanent hotlinking of images is not allowed", pixabay.com/api/docs),
 * e o link da busca expira em 24 h. A social_stock-search devolve, como url da imagem
 * escolhida, o endereço DESTA função: GET ?id=<id do Pixabay>.
 * - Primeira vez: pede a foto ao Pixabay pelo id, guarda em media/stock/pixabay/<id>.jpg
 *   e redireciona para a cópia.
 * - Depois: só redireciona (a cópia já existe).
 * Assim o post salvo, o canvas e a publicação usam sempre a cópia nossa.
 *
 * Sem login de propósito: é usada em <img src>, que não manda cabeçalho. Só aceita id
 * numérico e só busca em pixabay.com, então não serve para baixar outra coisa.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BUCKET = "media";

const texto = (msg: string, status: number) =>
  new Response(msg, { status, headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return texto("Method not allowed", 405);

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{1,12}$/.test(id)) return texto("id inválido", 400);

  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const caminho = `stock/pixabay/${id}.jpg`;
  const publico = `${base}/storage/v1/object/public/${BUCKET}/${caminho}`;
  const redirecionar = () =>
    new Response(null, { status: 302, headers: { ...corsHeaders, Location: publico, "Cache-Control": "public, max-age=86400" } });

  try {
    // Já guardada: só redireciona.
    const existe = await fetch(publico, { method: "HEAD", signal: AbortSignal.timeout(8_000) }).catch(() => null);
    if (existe?.ok) return redirecionar();

    const chave = Deno.env.get("PIXABAY_API_KEY")?.trim();
    if (!chave) return texto("Banco de imagens indisponível", 503);

    const busca = new URL("https://pixabay.com/api/");
    busca.searchParams.set("key", chave);
    busca.searchParams.set("id", id);
    const res = await fetch(busca.toString(), { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return texto(`Pixabay ${res.status}`, res.status === 429 ? 429 : 502);
    const hit = (await res.json())?.hits?.[0];
    const origem: string | undefined = hit?.largeImageURL || hit?.webformatURL;
    if (!origem || !/^https:\/\/([a-z0-9-]+\.)*pixabay\.com\//i.test(origem)) return texto("Imagem não encontrada", 404);

    const img = await fetch(origem, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) return texto(`Imagem ${img.status}`, 502);
    const tipo = img.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await img.arrayBuffer());

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await db.storage.from(BUCKET).upload(caminho, bytes, { upsert: true, contentType: tipo });
    if (error) {
      console.error("[stock-image] não guardou a imagem:", error.message);
      return texto("Não foi possível guardar a imagem", 502);
    }
    console.log(`[stock-image] Pixabay ${id} guardada (${Math.round(bytes.length / 1024)} KB)`);
    return redirecionar();
  } catch (e) {
    console.error("[stock-image] erro:", e instanceof Error ? e.message : e);
    return texto("Erro ao buscar a imagem", 502);
  }
});
