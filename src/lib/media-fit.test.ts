import { describe, it, expect } from "vitest";
import { coverCrop } from "./media-fit";

describe("coverCrop", () => {
  it("quadrado 1024 para 1080x1080 usa a imagem inteira", () => {
    expect(coverCrop(1024, 1024, 1080, 1080)).toEqual({ sx: 0, sy: 0, sW: 1024, sH: 1024 });
  });
  it("2:3 (1024x1536) para 4:5 corta topo e base igualmente", () => {
    const r = coverCrop(1024, 1536, 1080, 1350);
    expect(r.sW).toBe(1024);
    expect(r.sH).toBeCloseTo(1280);
    expect(r.sy).toBeCloseTo(128);
  });
  it("2:3 para 9:16 corta as laterais", () => {
    const r = coverCrop(1024, 1536, 1080, 1920);
    expect(r.sH).toBe(1536);
    expect(r.sW).toBeCloseTo(864);
    expect(r.sx).toBeCloseTo(80);
  });
});
