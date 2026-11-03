/**
 * supabase-tracker — instrumento DEV-only p/ rastrear TODAS as payloads que o app
 * recebe e envia ao backend Supabase (REST/DB, RPC, Auth, Storage, Edge Functions).
 *
 * Faz patch no window.fetch e registra cada request/response para *.supabase.co:
 *   método, endpoint, query, body enviado, status, resposta, latência.
 *
 * Console:  cada chamada loga `[SB:DB|FN|AUTH|STORAGE] METHOD /path … status ms`.
 * Globais:  window.__supabaseTraffic  → array com tudo (cap 500, mais recentes)
 *           window.__dumpTraffic()    → baixa supabase-traffic.json
 *           window.__clearTraffic()   → zera o buffer
 *
 * Só ativa em DEV (ver wiring em main.tsx). Reversível: remova o import + este arquivo.
 */
export type TrafficEntry = {
  t: string; layer: string; method: string; endpoint: string; query?: string;
  reqBody?: unknown; status?: number; resp?: unknown; ms?: number;
};

const MAX = 500;
const store: TrafficEntry[] = [];

function parseBody(b: BodyInit | null | undefined): unknown {
  if (b == null) return undefined;
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return b.slice(0, 600); } }
  return "[binary/stream]";
}
function cap(v: unknown): unknown {
  try {
    if (Array.isArray(v)) return v.slice(0, 5);
    const s = JSON.stringify(v);
    return s && s.length > 1200 ? (s.slice(0, 1200) + "…") : v;
  } catch { return v; }
}
function layerOf(path: string): string {
  if (path.startsWith("/rest/")) return "DB";
  if (path.startsWith("/functions/")) return "FN";
  if (path.startsWith("/auth/")) return "AUTH";
  if (path.startsWith("/storage/")) return "STORAGE";
  return "SB";
}

export function installSupabaseTracker(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w.__sbTrackerInstalled) return;
  w.__sbTrackerInstalled = true;

  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!url || !url.includes("supabase.co")) return orig(input as RequestInfo, init);

    const method = (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    const u = new URL(url);
    const reqBody = parseBody(init?.body ?? (input instanceof Request ? null : null));
    const start = performance.now();
    const res = await orig(input as RequestInfo, init);
    const ms = Math.round(performance.now() - start);

    let resp: unknown;
    try {
      const clone = res.clone();
      const ct = clone.headers.get("content-type") || "";
      if (/json/.test(ct)) resp = await clone.json();
      else if (/text/.test(ct)) resp = (await clone.text()).slice(0, 600);
    } catch { /* unreadable */ }

    const layer = layerOf(u.pathname);
    const entry: TrafficEntry = {
      t: new Date().toISOString(), layer, method, endpoint: u.pathname,
      query: u.search || undefined, reqBody, status: res.status, resp: cap(resp), ms,
    };
    store.push(entry);
    if (store.length > MAX) store.shift();
    w.__supabaseTraffic = store;

    const color = res.status >= 400 ? "#ef4444" : "#e85600";
    // eslint-disable-next-line no-console
    console.debug(`%c[SB:${layer}] ${method} ${u.pathname}${u.search}`, `color:${color}`, res.status, `${ms}ms`, reqBody ?? "", resp ?? "");
    return res;
  };

  w.__dumpTraffic = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "supabase-traffic.json"; a.click();
    return store;
  };
  w.__clearTraffic = () => { store.length = 0; };
  // eslint-disable-next-line no-console
  console.info("%c[SB tracker] ativo — window.__supabaseTraffic · __dumpTraffic() · __clearTraffic()", "color:#e85600;font-weight:bold");
}
