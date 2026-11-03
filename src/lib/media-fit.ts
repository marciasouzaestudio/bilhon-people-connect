/**
 * Ajuste de mídia para a proporção esperada por cada destino social.
 *
 * Problema: o gerador produz imagens em 2:3 (1024x1536). O Instagram Stories,
 * Reels, TikTok e Shorts renderizam num canvas 9:16 e não fazem zoom — o
 * resultado é a imagem aparecer pequena num canto. Aqui geramos uma variante
 * cover-crop por proporção alvo para preencher o frame sem bordas.
 */

export type FitMode = "cover" | "contain";

/** Proporção (w/h) esperada para cada plataforma/placement. null = manter. */
export function targetAspectFor(
  platform?: string,
  placement?: "timeline" | "reels" | "stories",
): number | null {
  const p = (platform || "").toLowerCase();
  if (p === "instagram") {
    if (placement === "stories" || placement === "reels") return 9 / 16;
    return 4 / 5; // feed retrato (padrão IG)
  }
  if (p === "tiktok" || p === "youtube" || p === "snapchat") return 9 / 16;
  if (p === "facebook") return placement === "stories" ? 9 / 16 : 4 / 5;
  if (p === "pinterest") return 2 / 3;
  if (p === "twitter" || p === "x" || p === "linkedin" || p === "threads" || p === "bluesky") return 1;
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renderiza a imagem num canvas com a proporção alvo (cover por padrão) e retorna PNG. */
export async function fitImageToAspect(
  src: string,
  aspect: number,
  mode: FitMode = "cover",
  maxLongEdge = 1920,
): Promise<Blob> {
  const img = await loadImage(src);
  // Dimensiona o canvas para a proporção alvo respeitando o lado maior da imagem.
  let outW: number;
  let outH: number;
  if (aspect >= 1) {
    outW = Math.min(maxLongEdge, Math.max(img.naturalWidth, Math.round(img.naturalHeight * aspect)));
    outH = Math.round(outW / aspect);
  } else {
    outH = Math.min(maxLongEdge, Math.max(img.naturalHeight, Math.round(img.naturalWidth / aspect)));
    outW = Math.round(outH * aspect);
  }
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outW, outH);

  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = outW / outH;
  let sx = 0, sy = 0, sW = img.naturalWidth, sH = img.naturalHeight;
  let dx = 0, dy = 0, dW = outW, dH = outH;

  if (mode === "cover") {
    if (srcRatio > dstRatio) {
      // origem mais larga → recortar laterais
      sW = img.naturalHeight * dstRatio;
      sx = (img.naturalWidth - sW) / 2;
    } else {
      // origem mais alta → recortar topo/base
      sH = img.naturalWidth / dstRatio;
      sy = (img.naturalHeight - sH) / 2;
    }
  } else {
    // contain — letterbox (mantém imagem inteira com bordas pretas)
    if (srcRatio > dstRatio) {
      dH = outW / srcRatio;
      dy = (outH - dH) / 2;
    } else {
      dW = outH * srcRatio;
      dx = (outW - dW) / 2;
    }
  }

  ctx.drawImage(img, sx, sy, sW, sH, dx, dy, dW, dH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png", 0.95);
  });
}

/** Dimensões finais de um cover-crop: proporção alvo e escala para exatamente width×height. */
export function coverCrop(srcW: number, srcH: number, width: number, height: number): { sx: number; sy: number; sW: number; sH: number } {
  const dstRatio = width / height;
  const srcRatio = srcW / srcH;
  if (srcRatio > dstRatio) {
    const sW = srcH * dstRatio;
    return { sx: (srcW - sW) / 2, sy: 0, sW, sH: srcH };
  }
  const sH = srcW / dstRatio;
  return { sx: 0, sy: (srcH - sH) / 2, sW: srcW, sH };
}

/**
 * Renderiza a imagem em EXATAMENTE width×height (cover-crop centralizado +
 * reescala, inclusive para cima). Usado pelos criativos da Meta, que têm
 * resolução recomendada fixa (ex.: 1080×1350).
 */
export async function fitImageToSize(src: string, width: number, height: number): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const { sx, sy, sW, sH } = coverCrop(img.naturalWidth, img.naturalHeight, width, height);
  ctx.drawImage(img, sx, sy, sW, sH, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png", 0.95);
  });
}

export function isVideoUrl(u?: string): boolean {
  if (!u) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) || u.startsWith("data:video/");
}