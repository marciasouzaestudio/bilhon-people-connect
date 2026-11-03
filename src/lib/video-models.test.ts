import { describe, it, expect } from "vitest";
import { STUDIO_VIDEO_MODELS, getStudioVideoModel } from "./video-models";

describe("video-models", () => {
  it("getStudioVideoModel encontra por id e retorna undefined p/ inexistente", () => {
    expect(getStudioVideoModel("google/veo-3.1")?.family).toBe("Veo-Gemini");
    expect(getStudioVideoModel("inexistente")).toBeUndefined();
  });

  it("tem o Veo 3.1 como modelo único text-to-video com durações válidas", () => {
    const tv = STUDIO_VIDEO_MODELS.filter((m) => m.kind === "text-to-video");
    expect(tv).toHaveLength(1);
    expect(tv[0].id).toBe("google/veo-3.1");
    for (const m of tv) {
      expect(m.durations.length).toBeGreaterThan(0);
      expect(m.durations.every((d) => d > 0)).toBe(true);
    }
  });
});
