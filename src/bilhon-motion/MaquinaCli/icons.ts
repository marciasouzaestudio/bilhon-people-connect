// ----------------------------------------------------------------------------
// CONTEÚDO EDITÁVEL (icons.ts) — texto/copy dos terminais e ícones-trilha são
// CUSTOMIZÁVEIS por projeto. Ajuste livremente as 6 interações / 5 peças.
// (O motor, os timings e os @keyframes vivem nos outros arquivos — não mexa lá.)
// Copiado por apply-bilhon-ds (make-motion-layer). DROP-IN reversível.
// ----------------------------------------------------------------------------

// =============================================================================
// Mapa dos 5 icones-trilha (topo) + o icone central orquestrador.
// SVGs copiados de bilhon-brandbook/.../public/bilhon/icons/ para public/maquina/.
// trackColor = classe de cor da `moving-line` (luz correndo na haste vertical).
// =============================================================================

export type TrackColor = "red" | "green" | "white" | "purple" | "blue";

export type TrackIcon = {
  /** caption curta exibida sob o icone (uppercase no CSS) */
  caption: string;
  /** path servido por Next a partir de public/ */
  src: string;
  alt: string;
  trackColor: TrackColor;
  /** marca a track "yellow" (HIGH) — adiciona modificador de container */
  yellow?: boolean;
};

/** 5 pecas, na ordem do markup original (esquerda -> direita). */
export const TRACK_ICONS: TrackIcon[] = [
  { caption: "Movimento", src: "/maquina/Data-Icon.svg", alt: "Movimento", trackColor: "red" },
  { caption: "Aquisição", src: "/maquina/Language-Pixel.svg", alt: "Aquisição", trackColor: "green" },
  { caption: "Médio Ticket", src: "/maquina/Plug--Play.svg", alt: "Médio Ticket", trackColor: "white" },
  { caption: "High Ticket", src: "/maquina/Workflow-Icon.svg", alt: "High Ticket", trackColor: "purple", yellow: true },
  { caption: "Recorrência", src: "/maquina/Privacy-Pixel.svg", alt: "Recorrência", trackColor: "blue" },
];

/** Icone central (IA Bilhon — linchpin orquestrador). */
export const HERO_ICON = {
  src: "/maquina/Team-Overline-Icon.svg",
  alt: "IA Bilhon — linchpin orquestrador",
} as const;
