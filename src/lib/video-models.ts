/**
 * Catálogo de vídeo da plataforma.
 * Regra atual: todo vídeo é gerado pelo Gemini Omni Flash (id interno "google/veo-3.1" mantido por compatibilidade).
 */

export type VideoModelKind = "text-to-video" | "image-to-video";

export interface StudioVideoModel {
  id: string;                  // model_id usado no endpoint POST /{id}
  label: string;               // texto exibido no select
  family: string;              // agrupamento exibido na UI
  kind: VideoModelKind;
  durations: number[];         // segundos suportados
  resolutions?: string[];      // ex: ["720p","1080p"]; omit = não exibir
  qualities?: string[];        // ex: ["basic","high"]; omit = não exibir
  supportsAudio: boolean;      // mostra toggle "Gerar áudio"
  defaultAudio?: boolean;      // default do toggle (true se suportado)
  ptbrSpeech?: boolean;        // o TTS do modelo FALA português brasileiro (Kling não: só en/zh/ja/ko/es)
  description?: string;
}

export const STUDIO_VIDEO_MODELS: StudioVideoModel[] = [
  {
    id: "google/veo-3.1",
    label: "Gemini Omni Flash: Texto→Vídeo (áudio + fala pt-BR) · PADRÃO",
    family: "Veo-Gemini",
    kind: "text-to-video",
    durations: [8, 6, 4],
    resolutions: ["1080p", "720p"],
    supportsAudio: true,
    defaultAudio: true,
    ptbrSpeech: true,
    description: "Padrão único do Studio. Chama a API Gemini com o Omni Flash (o Veo 3.1 preview foi desligado em 22/10/2026) usando a GEMINI_API_KEY salva no ambiente.",
  },
];

export function getStudioVideoModel(id: string): StudioVideoModel | undefined {
  return STUDIO_VIDEO_MODELS.find((m) => m.id === id);
}

export function getStudioVideoModelsByFamily(): Record<string, StudioVideoModel[]> {
  return STUDIO_VIDEO_MODELS.reduce<Record<string, StudioVideoModel[]>>((acc, m) => {
    (acc[m.family] ||= []).push(m);
    return acc;
  }, {});
}