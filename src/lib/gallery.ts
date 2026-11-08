/**
 * Gallery Service — persists creations in Supabase `creations` table
 */

import { supabase } from "@/lib/app-db-client";
import { requireOrgId } from "@/lib/org";

/**
 * De onde a mídia veio. `ai` é o default histórico — as criações salvas antes
 * da entrada de mídia própria nasceram todas da IA.
 */
export type CreationOrigin = "ai" | "upload" | "stock";

export interface Creation {
  id: string;
  type: "image" | "video" | "carousel";
  urls: string[];
  thumbnailUrl?: string;
  prompt?: string;
  templateId?: string;
  templateName?: string;
  sourceId?: string;
  origin: CreationOrigin;
  published: boolean;
  createdAt: string;
}

// ─── Public API ─────────────────────────────────────────────────

export async function getCreations(filter?: "image" | "video" | "carousel"): Promise<Creation[]> {
  let query = supabase
    .from("creations")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter) {
    query = query.eq("type", filter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load creations:", error);
    return [];
  }

  return (data || []).map(mapRow);
}

export async function getCreation(id: string): Promise<Creation | null> {
  const { data, error } = await supabase
    .from("creations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

export async function saveCreation(
  input: Omit<Creation, "id" | "createdAt" | "origin"> & { origin?: CreationOrigin },
): Promise<Creation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const org_id = await requireOrgId();

  const { data, error } = await supabase
    .from("creations")
    .insert({
      org_id,
      user_id: user.id,
      type: input.type,
      urls: input.urls,
      thumbnail_url: input.thumbnailUrl || input.urls[0] || null,
      prompt: input.prompt || null,
      template_id: input.templateId || null,
      template_name: input.templateName || null,
      source_id: input.sourceId || null,
      metadata: { origin: input.origin || "ai" },
      published: input.published,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save creation:", error);
    return null;
  }
  return mapRow(data);
}

export async function updateCreation(id: string, updates: Partial<Creation>): Promise<Creation | null> {
  const payload: Record<string, unknown> = {};
  if (updates.published !== undefined) payload.published = updates.published;
  if (updates.urls) payload.urls = updates.urls;
  if (updates.prompt !== undefined) payload.prompt = updates.prompt;
  if (updates.type) payload.type = updates.type;
  if (updates.thumbnailUrl !== undefined) payload.thumbnail_url = updates.thumbnailUrl;

  const { data, error } = await supabase
    .from("creations")
    .update(payload as any)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update creation:", error);
    return null;
  }
  return mapRow(data);
}

export async function deleteCreation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("creations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete creation:", error);
    return false;
  }
  return true;
}

export async function markAsPublished(id: string): Promise<void> {
  await updateCreation(id, { published: true });
}

/**
 * Find gallery item by any matching URL and mark as published
 */
function normalizeUrl(url: string): string {
  return url.split("?")[0].replace(/\/+$/, "");
}

export async function markAsPublishedByUrls(urls: string[]): Promise<void> {
  if (!urls.length) return;

  // Fetch unpublished creations
  const { data } = await supabase
    .from("creations")
    .select("id, urls")
    .eq("published", false);

  if (!data?.length) return;

  const normalizedUrls = urls.map(normalizeUrl);
  const idsToUpdate: string[] = [];

  for (const row of data) {
    const match = (row.urls || []).some((u: string) => {
      const normalized = normalizeUrl(u);
      return normalizedUrls.includes(normalized) || urls.includes(u);
    });
    if (match) idsToUpdate.push(row.id);
  }

  if (idsToUpdate.length > 0) {
    await supabase
      .from("creations")
      .update({ published: true })
      .in("id", idsToUpdate);
  }
}

/**
 * Persiste URLs: data: URLs são upadas pro storage e viram http; blob: são descartadas.
 */
async function persistUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    if (u.startsWith("http")) {
      out.push(u);
    } else if (u.startsWith("data:")) {
      // Upload data URL pro Supabase storage
      try {
        const [head, b64] = u.split(",");
        const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
        const ext = mime.split("/")[1] || "png";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;
        // Path deve começar com o user.id pra bater com a RLS INSERT do bucket "media".
        const path = `${user.id}/gallery/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, bytes, { contentType: mime });
        if (!error) {
          out.push(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
        } else {
          console.error("[gallery] upload falhou:", error.message);
        }
      } catch { /* skip this one */ }
    }
    // blob: URLs are discarded (não persistentes)
  }
  return out;
}

/**
 * Save a visual creation to the gallery. Handles data: URLs automatically
 * (uploads to storage first). NENHUMA criação se perde.
 */
export async function saveVisualToGallery(opts: {
  urls: string[];
  prompt?: string;
  templateId?: string;
  templateName?: string;
}): Promise<Creation | null> {
  const validUrls = await persistUrls(opts.urls);
  if (validUrls.length === 0) return null;

  const isVideo = validUrls.some((u) => /\.(mp4|mov|webm)/i.test(u) || u.includes("tool=veo_file"));
  const isCarousel = validUrls.length > 1 && !isVideo;

  return saveCreation({
    type: isVideo ? "video" : isCarousel ? "carousel" : "image",
    urls: validUrls,
    thumbnailUrl: validUrls[0],
    prompt: opts.prompt,
    templateId: opts.templateId,
    templateName: opts.templateName,
    published: false,
  });
}

/**
 * Save uploaded media to gallery. Handles data: URLs (uploads automatically).
 *
 * `origin` default "ai": os chamadores históricos (publicação no Studio) passam
 * a arte gerada pela IA. A mídia própria do cliente entra pelo dialog "Incluir
 * imagem", que passa "upload"/"stock" explicitamente.
 */
export async function saveUploadToGallery(
  urls: string[],
  opts?: { origin?: CreationOrigin; templateName?: string },
): Promise<Creation | null> {
  const validUrls = await persistUrls(urls);
  if (validUrls.length === 0) return null;

  const isVideo = validUrls.some((u) => /\.(mp4|mov|webm)/i.test(u) || u.includes("tool=veo_file"));
  return saveCreation({
    type: isVideo ? "video" : validUrls.length > 1 ? "carousel" : "image",
    urls: validUrls,
    thumbnailUrl: validUrls[0],
    templateName: opts?.templateName,
    origin: opts?.origin || "ai",
    published: false,
  });
}

// ─── Internal helper ────────────────────────────────────────────

function mapRow(row: any): Creation {
  return {
    id: row.id,
    type: row.type || "image",
    urls: row.urls || [],
    thumbnailUrl: row.thumbnail_url || (row.urls?.[0] ?? undefined),
    prompt: row.prompt || undefined,
    templateId: row.template_id || undefined,
    templateName: row.template_name || undefined,
    sourceId: row.source_id || undefined,
    origin: (row.metadata?.origin as CreationOrigin) || "ai",
    published: row.published ?? false,
    createdAt: row.created_at,
  };
}
