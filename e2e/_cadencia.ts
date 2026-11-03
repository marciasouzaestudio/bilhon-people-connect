/**
 * Cadência de gravação — o MESMO spec roda em dois modos:
 *
 *   npx playwright test                    → rápido, serve de regressão no CI
 *   E2E_CADENCIA=1 npx playwright test     → ritmo humano, para o take de vídeo
 *
 * As asserções são idênticas nos dois; a env só liga digitação visível e as
 * pausas. Assim a cadência não apodrece: o spec continua barato de rodar.
 */
import type { Locator, Page } from "@playwright/test";

export const CADENCIA = !!process.env.E2E_CADENCIA;

/**
 * Multiplicador global do ritmo. 1.8 é o que põe uma jornada de 3 cenas na
 * faixa de 2,5–3 min — abaixo de 2 min o espectador não acompanha o que mudou.
 * `E2E_RITMO=2.4` alarga mais (demo de venda); `1` volta ao ritmo cru.
 */
export const RITMO = Number(process.env.E2E_RITMO || 1.8);

/** Pausa que só existe no modo cadência. */
export async function pausa(page: Page, ms: number) {
  if (CADENCIA) await page.waitForTimeout(Math.round(ms * RITMO));
}

/** Digita caractere a caractere — `fill` é instantâneo e o espectador não lê. */
export async function digitar(campo: Locator, texto: string) {
  if (CADENCIA) {
    await campo.click();
    await campo.pressSequentially(texto, { delay: 45 });
  } else {
    await campo.fill(texto);
  }
}

/** Clique com batida antes e depois, para o olho acompanhar o que mudou. */
export async function clicar(page: Page, alvo: Locator, antes = 600, depois = 1100) {
  await alvo.scrollIntoViewIfNeeded();
  await pausa(page, antes);
  await alvo.click();
  await pausa(page, depois);
}

/** Destaca em ouro o elemento que é a prova — sem alterar o layout. */
export async function apontar(page: Page, alvo: Locator, msBase = 2600) {
  if (!CADENCIA) return;
  const ms = Math.round(msBase * RITMO);
  await alvo.scrollIntoViewIfNeeded();
  await alvo.evaluate((el: HTMLElement) => {
    el.style.outline = "3px solid #B9915B";
    el.style.outlineOffset = "3px";
    el.style.borderRadius = "8px";
  });
  await page.waitForTimeout(ms);
  await alvo.evaluate((el: HTMLElement) => {
    el.style.outline = "";
    el.style.outlineOffset = "";
  });
}

/** Cartão de fase (config · uso · teste) sobreposto — disciplina o roteiro. */
export async function faseNaTela(page: Page, fase: "config" | "uso" | "teste", titulo: string, msBase = 2200) {
  if (!CADENCIA) return;
  const ms = Math.round(msBase * RITMO);
  await page.evaluate(
    ({ fase, titulo }) => {
      const d = document.createElement("div");
      d.id = "__fase";
      d.style.cssText =
        "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;" +
        "justify-content:center;gap:12px;background:rgba(12,12,14,.93);color:#FAFAF7;" +
        "font-family:system-ui,sans-serif;text-align:center;padding:40px";
      d.innerHTML =
        `<div style="letter-spacing:.28em;text-transform:uppercase;font-size:13px;color:#B9915B">${fase}</div>` +
        `<div style="font-size:30px;font-weight:600;max-width:900px;line-height:1.3">${titulo}</div>`;
      document.body.appendChild(d);
    },
    { fase, titulo },
  );
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById("__fase")?.remove());
}

/**
 * Gera uma imagem real no próprio navegador (canvas → JPEG) e devolve o Buffer.
 * Evita depender de arquivo binário versionado no repo e dá uma foto
 * reconhecível na tela — o espectador vê QUAL imagem foi enviada.
 */
export async function imagemDemo(page: Page, rotulo: string, cor1: string, cor2: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ rotulo, cor1, cor2 }) => {
      const c = document.createElement("canvas");
      c.width = 1080; c.height = 1080;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, cor1);
      grad.addColorStop(1, cor2);
      g.fillStyle = grad;
      g.fillRect(0, 0, 1080, 1080);
      g.fillStyle = "rgba(255,255,255,.92)";
      g.font = "bold 78px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      rotulo.split("\n").forEach((linha, i, arr) => {
        g.fillText(linha, 540, 540 + (i - (arr.length - 1) / 2) * 96);
      });
      return c.toDataURL("image/jpeg", 0.92);
    },
    { rotulo, cor1, cor2 },
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}
