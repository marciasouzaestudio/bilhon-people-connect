import { describe, it, expect } from "vitest";
import { brandVideoDirective, brandVoiceDirective, brandImageDirective, type BrandProfile } from "./brand";

const brand: BrandProfile = {
  id: "1", name: "Acme", tone: "inspirador", industry: "fitness",
  keywords: [], avoid_words: [], example_posts: [], colors: ["#111", "#222"],
  is_default: true, values: "saúde e energia",
};

describe("brandVideoDirective", () => {
  it("inclui marca, paleta, setor, valores e cinematografia", () => {
    const d = brandVideoDirective(brand);
    expect(d).toContain("Acme");
    expect(d).toContain("#111");
    expect(d).toContain("fitness");
    expect(d).toContain("saúde e energia");
    expect(d.toLowerCase()).toContain("cinematografia");
  });
  it("NÃO proíbe texto (diferente da diretiva de imagem)", () => {
    expect(brandVideoDirective(brand).toLowerCase()).not.toContain("não renderize texto");
  });
  it("sem marca retorna fallback cinematográfico", () => {
    expect(brandVideoDirective(null).toLowerCase()).toContain("cinematografia");
  });
});

describe("brandVoiceDirective", () => {
  it("usa o tom da marca", () => {
    expect(brandVoiceDirective(brand)).toContain("inspirador");
    expect(brandVoiceDirective(brand).toLowerCase()).toContain("português");
  });
  it("default profissional sem marca", () => {
    expect(brandVoiceDirective(null)).toContain("profissional");
  });
});

describe("brandImageDirective (regressão)", () => {
  it("continua proibindo texto/logo na imagem", () => {
    expect(brandImageDirective(brand).toLowerCase()).toContain("não renderize texto");
  });
});
