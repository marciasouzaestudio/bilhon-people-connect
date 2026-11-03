import { describe, it, expect } from "vitest";
import {
  buildImagePrompt, brandAdDirective, creativeFilename, creativesToCsv, setCsvFilename, slugify, mergeOfferFromAI, offerFromRow, offerToAI, offerToRow, pickReferences,
  DEFAULT_SET_OPTIONS, EMPTY_OFFER, type Creative, type OfferInput,
} from "./creatives";
import type { BrandProfile } from "./brand";
import type { CreativeAngle } from "./api/creatives";

const brand: BrandProfile = {
  id: "b1", name: "Acme", tone: "inspirador", industry: "fitness",
  keywords: [], avoid_words: [], example_posts: [], colors: ["#111", "#f60"],
  is_default: true, values: "energia", logo_url: "https://cdn/logo.png",
};

const offer: OfferInput = {
  ...EMPTY_OFFER,
  brandId: "b1",
  name: "Whey Pro",
  description: "Proteína isolada 900g",
  promise: "Mais massa magra em 60 dias",
  benefits: ["27g de proteína por dose"],
  socialProof: ["+10 mil clientes"],
  productImages: ["https://cdn/p1.png", "https://cdn/p2.png", "https://cdn/p3.png", "https://cdn/p4.png", "https://cdn/p5.png"],
  ctaType: "SHOP_NOW",
};

const angle: CreativeAngle = {
  id: "a1", name: "Prova social", hook_type: "prova_social", rationale: "",
  headline: "Escolha de 10 mil atletas", primary_text: "Texto", description: "Frete grátis", cta_type: "SHOP_NOW",
  visual: { scene: "pote sobre bancada de academia", composition: "produto centralizado", text_overlay: "10 mil atletas aprovam", style: "estúdio" },
};

describe("offerToAI / offerToRow", () => {
  it("omite campos vazios e mantém os preenchidos", () => {
    const ai = offerToAI(offer);
    expect(ai.name).toBe("Whey Pro");
    expect(ai.benefits).toEqual(["27g de proteína por dose"]);
    expect(ai).not.toHaveProperty("deadline");
    expect(ai).not.toHaveProperty("painPoints");
  });
  it("normaliza CTA inválido para LEARN_MORE na linha", () => {
    expect(offerToRow({ ...offer, ctaType: "qualquer" }).cta_type).toBe("LEARN_MORE");
    expect(offerToRow(offer).cta_type).toBe("SHOP_NOW");
  });
  it("offerFromRow tolera nulos", () => {
    const o = offerFromRow({ id: "x", name: "N", pain_points: null, cta_type: null });
    expect(o.painPoints).toEqual([]);
    expect(o.ctaType).toBe("LEARN_MORE");
    expect(o.productType).toBe("produto");
  });
});

describe("mergeOfferFromAI", () => {
  it("preenche o que está vazio e preserva o que o usuário já digitou", () => {
    const merged = mergeOfferFromAI({ ...EMPTY_OFFER, name: "Meu nome", price: "R$ 10" }, { name: "Outro", price: "", promise: "Promessa IA", painPoints: ["dor"] });
    expect(merged.name).toBe("Outro"); // IA trouxe valor → substitui
    expect(merged.price).toBe("R$ 10"); // IA veio vazia → mantém
    expect(merged.promise).toBe("Promessa IA");
    expect(merged.painPoints).toEqual(["dor"]);
  });
});

describe("pickReferences", () => {
  it("limita a 4 referências e reserva a última para o logo", () => {
    const r = pickReferences(offer, brand, DEFAULT_SET_OPTIONS);
    expect(r.urls).toHaveLength(4);
    expect(r.productCount).toBe(3);
    expect(r.hasLogo).toBe(true);
    expect(r.urls[3]).toBe("https://cdn/logo.png");
  });
  it("sem logo usa até 4 fotos do produto", () => {
    const r = pickReferences(offer, brand, { ...DEFAULT_SET_OPTIONS, includeLogo: false });
    expect(r.urls).toHaveLength(4);
    expect(r.hasLogo).toBe(false);
  });
  it("respeita as opções desligadas", () => {
    const r = pickReferences(offer, brand, { ...DEFAULT_SET_OPTIONS, includeLogo: false, useProductPhotos: false });
    expect(r.urls).toEqual([]);
  });
});

describe("buildImagePrompt", () => {
  const base = { brand, offer, angle, format: "story_9x16" as const, options: DEFAULT_SET_OPTIONS, references: { productCount: 2, hasLogo: true } };
  it("carrega marca, produto, cena, formato, referências e texto estampado", () => {
    const p = buildImagePrompt(base);
    expect(p).toContain("Acme");
    expect(p).toContain("#111");
    expect(p).toContain("Whey Pro");
    expect(p).toContain("pote sobre bancada");
    expect(p).toContain("9:16");
    expect(p).toContain("1080x1920");
    expect(p).toContain("2 primeiras imagens de referência");
    expect(p).toContain("logotipo oficial");
    expect(p).toContain('"10 mil atletas aprovam"');
  });
  it("sem texto na arte proíbe texto", () => {
    const p = buildImagePrompt({ ...base, options: { ...DEFAULT_SET_OPTIONS, textOnArt: false } });
    expect(p).toContain("Não renderize nenhum texto");
    expect(p).not.toContain("10 mil atletas aprovam");
  });
  it("estilo escolhido sobrepõe o estilo do brief", () => {
    const p = buildImagePrompt({ ...base, options: { ...DEFAULT_SET_OPTIONS, style: "ugc" } });
    expect(p.toLowerCase()).toContain("gerado por usuário");
    expect(p).not.toContain("Estilo: estúdio");
  });
  it("sem marca não quebra", () => {
    expect(brandAdDirective(null)).toBe("");
    expect(buildImagePrompt({ ...base, brand: null })).toContain("Whey Pro");
  });
});

describe("creativesToCsv", () => {
  it("escapa aspas e quebra uma linha por peça", () => {
    const c: Creative = {
      id: "1", setId: "s", offerId: "o", brandId: null, angleId: "a1", angleName: "Prova", hookType: "prova_social", format: "feed_1x1",
      headline: 'Ele disse "uau"', primaryText: "t", description: "d", ctaType: "SHOP_NOW", textOverlay: "", imageUrl: "https://x/1.png",
      imagePrompt: "", status: "approved", sortOrder: 0, metadata: {}, createdAt: "",
    };
    const csv = creativesToCsv([c]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("headline");
    expect(lines[1]).toContain('"Ele disse ""uau"""');
    expect(lines[1]).toContain("1:1");
  });
});

describe("regra de marca no prompt", () => {
  const base = { brand, offer: { ...offer, productImages: [] }, angle, format: "feed_1x1" as const, options: DEFAULT_SET_OPTIONS, references: { productCount: 0, hasLogo: true } };
  it("proíbe a marca e o logo sobre o produto/embalagem", () => {
    const p = buildImagePrompt(base);
    expect(p).toContain('Nunca escreva "Acme"');
    expect(p).toContain("fora do produto");
  });
  it("sem foto, a embalagem traz só o nome do produto", () => {
    expect(buildImagePrompt(base)).toContain('apenas o nome "Whey Pro"');
  });
  it("com foto do produto não emite a regra de embalagem inventada", () => {
    expect(buildImagePrompt({ ...base, references: { productCount: 1, hasLogo: false } })).not.toContain("Sem foto do produto");
  });
});

describe("nomes de arquivo", () => {
  it("remove acentos sem perder a letra", () => {
    expect(slugify("Café Serra Alta Especial 250g · Vendas / Conversão")).toBe("cafe-serra-alta-especial-250g-vendas-conversao");
    expect(setCsvFilename("Café · Conversão")).toBe("criativos-cafe-conversao.csv");
    expect(creativeFilename({ angleName: "Fim do Café Amargo", format: "feed_4x5" })).toBe("fim-do-cafe-amargo-feed_4x5.png");
  });
  it("usa fallback quando o nome fica vazio", () => {
    expect(slugify("···")).toBe("criativo");
    expect(setCsvFilename("")).toBe("criativos-conjunto.csv");
  });
});
