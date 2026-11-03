import { describe, it, expect } from "vitest";
import { CREATIVE_FORMATS, copyLength, ctaLabel, formatSpec, hookLabel, normalizeCta, styleDirective } from "./meta-creative-specs";

describe("formatos da Meta", () => {
  it("tem os 3 placements com resolução recomendada", () => {
    expect(CREATIVE_FORMATS.map((f) => f.id)).toEqual(["feed_1x1", "feed_4x5", "story_9x16"]);
    expect(formatSpec("story_9x16")).toMatchObject({ width: 1080, height: 1920, genSize: "1024x1536" });
    expect(formatSpec("feed_1x1").ratio).toBe(1);
  });
  it("formato desconhecido cai no 1:1", () => {
    expect(formatSpec("x").id).toBe("feed_1x1");
  });
});

describe("copyLength", () => {
  it("classifica contra recomendado e máximo", () => {
    expect(copyLength("headline", "a".repeat(40))).toBe("ok");
    expect(copyLength("headline", "a".repeat(41))).toBe("long");
    expect(copyLength("primaryText", "a".repeat(301))).toBe("over");
    expect(copyLength("description", "")).toBe("ok");
  });
});

describe("CTA", () => {
  it("normaliza e rotula", () => {
    expect(normalizeCta("shop_now")).toBe("SHOP_NOW");
    expect(normalizeCta("Comprar")).toBe("LEARN_MORE");
    expect(normalizeCta(null)).toBe("LEARN_MORE");
    expect(ctaLabel("WHATSAPP_MESSAGE")).toContain("WhatsApp");
  });
});

describe("rótulos", () => {
  it("hook e estilo", () => {
    expect(hookLabel("prova_social")).toBe("Prova social");
    expect(hookLabel("")).toBe("Ângulo");
    expect(styleDirective("auto")).toBe("");
    expect(styleDirective("flat")).toContain("flat");
  });
});
