import type { Platform } from "@/types";

export type StudioFormat = "post" | "carousel" | "image" | "video" | "card";

export type ElType = "text" | "image" | "shape";

export interface El {
  id: string;
  type: ElType;
  x: number; y: number; w: number; h: number;
  // text
  text?: string;
  fontSize?: number;
  color?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  // image
  src?: string;
  radius?: number;
  // shape
  bg?: string;
  opacity?: number;
  // efeitos (texto/imagem/forma)
  shadow?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
}

/** Fontes disponíveis no editor (web-safe / fallbacks que renderizam sem carregar). */
export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Padrão", value: "default" },
  { label: "Inter / Sistema", value: "Inter, system-ui, sans-serif" },
  { label: "Serifada", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Display", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Manuscrita", value: "'Comic Sans MS', cursive" },
];

/** Tolerância de encaixe (snap) em px do canvas. */
export const SNAP = 6;

export interface Slide {
  bg: string;          // cor sólida ou gradiente CSS
  bgImage?: string;    // url/data url de fundo
  els: El[];
}

export interface StudioDoc {
  format: StudioFormat;
  brandId: string | null;
  slides: Slide[];          // 1 p/ image/post; N p/ carrossel
  videoUrl?: string;        // formato vídeo
  caption: string;
  captionsByPlatform?: Record<string, string>;
  hashtags: string[];
  platforms: Platform[];
  schedule: { when: "now" | "schedule"; at?: string };
}

// Canvas 4:5 (1080×1350) — padrão Instagram 2026.
// Preview em 360×450 (escala 3x no export = 1080×1350).
export const CANVAS_W = 360;
export const CANVAS_H = 450;
export const CANVAS_PX = CANVAS_W; // compat (largura)
export const EXPORT_W = 1080;
export const EXPORT_H = 1350;

// Tamanho do gpt-image-2 mais próximo de 4:5 (o modelo aceita 1024x1536 = 2:3).
export const IMAGE_SIZE = "1024x1536" as const;

export const uid = () => Math.random().toString(36).slice(2, 9);
