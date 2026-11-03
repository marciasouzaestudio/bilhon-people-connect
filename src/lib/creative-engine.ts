/**
 * Motor de geração do módulo Criativos: transforma o plano de ângulos (copy +
 * brief visual) em peças finais — 1 imagem por ângulo × formato — com
 * concorrência limitada (o rate-limit da função é por usuário), recorte para a
 * proporção da Meta e persistência (storage + tabela creatives + galeria).
 */

import { generateCreativeImage, type CreativeAngle } from "@/lib/api/creatives";
import type { BrandProfile } from "@/lib/brand";
import { fitImageToSize } from "@/lib/media-fit";
import { saveCreation } from "@/lib/gallery";
import { formatSpec, normalizeCta, type CreativeFormat } from "@/lib/meta-creative-specs";
import {
  buildImagePrompt, createSet, insertCreative, pickReferences, updateCreative, updateSetStatus, uploadCreativeBlob,
  type Creative, type CreativeOffer, type CreativeSet, type CreativeSetOptions,
} from "@/lib/creatives";

export interface GenerateSetInput {
  offer: CreativeOffer;
  brand: BrandProfile | null;
  name: string;
  objective: string;
  formats: CreativeFormat[];
  options: CreativeSetOptions;
  strategyNote: string;
  angles: CreativeAngle[];
  onProgress?: (done: number, total: number, label: string) => void;
}

export interface GenerateSetResult {
  set: CreativeSet;
  creatives: Creative[];
  failed: number;
}

const CONCURRENCY = 3;

/** Espelha a arte na Galeria para o cliente reencontrá-la junto das outras criações. Best-effort. */
function mirrorToGallery(url: string, setId: string, offerName: string, headline: string): void {
  saveCreation({
    type: "image", urls: [url], thumbnailUrl: url, prompt: headline,
    templateId: `criativo:${setId}`, templateName: `Criativos · ${offerName}`, published: false,
  }).catch(() => { /* best-effort */ });
}

/** Executa `tasks` com no máximo `limit` em paralelo, preservando a ordem dos resultados. */
export async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

/** Gera a arte de 1 criativo: prompt → gpt-image → recorte → storage. Devolve URL pública + prompt usado. */
export async function renderCreativeImage(params: {
  setId: string;
  offer: CreativeOffer;
  brand: BrandProfile | null;
  angle: CreativeAngle;
  format: CreativeFormat;
  options: CreativeSetOptions;
}): Promise<{ url: string; prompt: string; mode: string }> {
  const refs = pickReferences(params.offer, params.brand, params.options);
  const prompt = buildImagePrompt({
    brand: params.brand, offer: params.offer, angle: params.angle, format: params.format, options: params.options,
    references: { productCount: refs.productCount, hasLogo: refs.hasLogo },
  });
  const spec = formatSpec(params.format);
  const { images, mode } = await generateCreativeImage({
    prompt, size: spec.genSize, quality: "medium", referenceImages: refs.urls.length ? refs.urls : undefined,
  });
  const raw = images[0];
  if (!raw) throw new Error("A IA não devolveu a arte.");
  // Recorta e redimensiona para a resolução exata recomendada pela Meta
  // (1080×1080, 1080×1350, 1080×1920). O gpt-image entrega 1024px no lado menor.
  const blob = await fitImageToSize(raw, spec.width, spec.height);
  const url = await uploadCreativeBlob(blob, params.setId);
  return { url, prompt, mode };
}

/** Cria o conjunto e gera todas as peças (ângulos × formatos). Falhas individuais não derrubam o lote. */
export async function generateCreativeSet(input: GenerateSetInput): Promise<GenerateSetResult> {
  const set = await createSet({
    offerId: input.offer.id,
    brandId: input.brand?.id || null,
    name: input.name,
    objective: input.objective,
    formats: input.formats,
    angleCount: input.angles.length,
    options: input.options,
    plan: { strategy_note: input.strategyNote, angles: input.angles },
  });

  const jobs: { angle: CreativeAngle; format: CreativeFormat; order: number }[] = [];
  let order = 0;
  for (const angle of input.angles) for (const format of input.formats) jobs.push({ angle, format, order: order++ });

  const total = jobs.length;
  let done = 0;
  let failed = 0;
  input.onProgress?.(0, total, "Iniciando a geração das artes…");

  const tasks = jobs.map((job) => async (): Promise<Creative | null> => {
    const base: Omit<Creative, "id" | "createdAt"> = {
      setId: set.id,
      offerId: input.offer.id,
      brandId: input.brand?.id || null,
      angleId: job.angle.id,
      angleName: job.angle.name,
      hookType: job.angle.hook_type,
      format: job.format,
      headline: job.angle.headline,
      primaryText: job.angle.primary_text,
      description: job.angle.description,
      ctaType: normalizeCta(job.angle.cta_type || input.offer.ctaType),
      textOverlay: input.options.textOnArt ? (job.angle.visual?.text_overlay || "") : "",
      imageUrl: null,
      imagePrompt: "",
      status: "draft",
      sortOrder: job.order,
      metadata: { alt_headlines: job.angle.alt_headlines || [], rationale: job.angle.rationale || "" },
    };
    try {
      const { url, prompt, mode } = await renderCreativeImage({
        setId: set.id, offer: input.offer, brand: input.brand, angle: job.angle, format: job.format, options: input.options,
      });
      const created = await insertCreative({ ...base, imageUrl: url, imagePrompt: prompt, metadata: { ...base.metadata, image_mode: mode } });
      mirrorToGallery(url, set.id, input.offer.name, job.angle.headline);
      return created;
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : "Erro ao gerar a arte";
      // Guarda a peça sem imagem: a copy continua útil e o usuário pode regenerar só a arte.
      try {
        return await insertCreative({ ...base, metadata: { ...base.metadata, error: message } });
      } catch { return null; }
    } finally {
      done += 1;
      input.onProgress?.(done, total, `${job.angle.name} · ${formatSpec(job.format).ratioLabel}`);
    }
  });

  const results = await runWithConcurrency(tasks, CONCURRENCY);
  const creatives = results.filter((c): c is Creative => !!c);
  const status = creatives.length === 0 ? "failed" : "done";
  await updateSetStatus(set.id, status, failed ? `${failed} de ${total} artes falharam` : null).catch(() => { /* best-effort */ });
  return { set: { ...set, status }, creatives, failed };
}

/** Regenera só a arte de uma peça existente (nova imagem, mesma copy). */
export async function regenerateCreativeImage(params: {
  creative: Creative;
  offer: CreativeOffer;
  brand: BrandProfile | null;
  options: CreativeSetOptions;
  angle: CreativeAngle;
}): Promise<string> {
  const { url, prompt, mode } = await renderCreativeImage({
    setId: params.creative.setId, offer: params.offer, brand: params.brand, angle: params.angle, format: params.creative.format, options: params.options,
  });
  await updateCreative(params.creative.id, {
    imageUrl: url, imagePrompt: prompt,
    metadata: { ...params.creative.metadata, error: undefined, image_mode: mode },
  });
  // A arte nova também vai para a Galeria (a anterior continua lá).
  mirrorToGallery(url, params.creative.setId, params.offer.name, params.creative.headline);
  return url;
}

/** Reconstrói o ângulo (copy + brief) a partir da peça salva + plano do conjunto. */
export function angleForCreative(creative: Creative, set: CreativeSet | null): CreativeAngle {
  const fromPlan = set?.plan?.angles?.find((a) => a.id === creative.angleId);
  return {
    id: creative.angleId,
    name: creative.angleName,
    hook_type: creative.hookType,
    rationale: String(creative.metadata?.rationale || fromPlan?.rationale || ""),
    headline: creative.headline,
    primary_text: creative.primaryText,
    description: creative.description,
    cta_type: creative.ctaType,
    visual: fromPlan?.visual || { scene: "", composition: "", text_overlay: creative.textOverlay, style: "" },
    alt_headlines: (creative.metadata?.alt_headlines as string[]) || fromPlan?.alt_headlines || [],
  };
}
