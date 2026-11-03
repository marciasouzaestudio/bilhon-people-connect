import { describe, it, expect } from "vitest";
import { validarArquivo, ehVideo, LIMITE_IMAGEM_MB, LIMITE_VIDEO_MB } from "./media-upload";

const MB = 1024 * 1024;

/** Cria um File com o tamanho pedido sem alocar os bytes de verdade. */
function arquivo(nome: string, type: string, tamanhoBytes: number): File {
  const f = new File(["x"], nome, { type });
  Object.defineProperty(f, "size", { value: tamanhoBytes });
  return f;
}

describe("ehVideo", () => {
  it("reconhece vídeo pelo mime type", () => {
    expect(ehVideo(arquivo("v.mp4", "video/mp4", 10))).toBe(true);
    expect(ehVideo(arquivo("i.png", "image/png", 10))).toBe(false);
  });
});

describe("validarArquivo", () => {
  it("aceita imagem dentro do limite", () => {
    expect(validarArquivo(arquivo("foto.jpg", "image/jpeg", 5 * MB))).toBeNull();
  });

  it("aceita vídeo dentro do limite", () => {
    expect(validarArquivo(arquivo("clipe.mp4", "video/mp4", 50 * MB))).toBeNull();
  });

  it("recusa formato que não é imagem nem vídeo", () => {
    const erro = validarArquivo(arquivo("planilha.xlsx", "application/vnd.ms-excel", 1 * MB));
    expect(erro).toMatch(/Formato não suportado/);
  });

  it("recusa imagem acima do limite citando o teto", () => {
    const erro = validarArquivo(arquivo("gigante.png", "image/png", (LIMITE_IMAGEM_MB + 1) * MB));
    expect(erro).toContain(`${LIMITE_IMAGEM_MB} MB`);
  });

  it("recusa vídeo acima do limite citando o teto", () => {
    const erro = validarArquivo(arquivo("longo.mp4", "video/mp4", (LIMITE_VIDEO_MB + 1) * MB));
    expect(erro).toContain(`${LIMITE_VIDEO_MB} MB`);
  });

  it("aplica ao vídeo o limite de vídeo, não o de imagem", () => {
    // Um arquivo maior que o teto de imagem mas menor que o de vídeo passa.
    const tamanho = (LIMITE_IMAGEM_MB + 10) * MB;
    expect(validarArquivo(arquivo("meio.mp4", "video/mp4", tamanho))).toBeNull();
    expect(validarArquivo(arquivo("meio.png", "image/png", tamanho))).not.toBeNull();
  });
});
