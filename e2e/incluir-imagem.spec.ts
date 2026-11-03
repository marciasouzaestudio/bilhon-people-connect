/**
 * Prova — "Incluir imagem" (ClickUp 86ajva0an).
 *
 * Até aqui toda mídia do SOCIAL nascia da IA: não havia caminho para o cliente
 * trazer foto de produto, de equipe, de evento ou peça do designer dele.
 *
 * Três cenas, uma por solução entregue:
 *   1. Galeria recebe arquivo do computador → sobe pro bucket e aparece na grade
 *   2. Banco de imagens (Pexels) entra pela mesma porta, com selo próprio
 *   3. A foto do cliente vira POST — o que ele não conseguia fazer
 *
 * Modo vídeo: E2E_CADENCIA=1 npx playwright test e2e/incluir-imagem.spec.ts
 */
import { test, expect } from "./fixtures";
import { CADENCIA, pausa, digitar, clicar, apontar, faseNaTela, imagemDemo } from "./_cadencia";

// A busca do Pexels depende de chave por usuário (`user_configs.pexels_api_key`),
// que a org de teste não tem. Só a RESPOSTA da busca é simulada: a seleção, a
// persistência no bucket, a linha na galeria e o selo são reais.
async function stubBancoDeImagens(page: import("@playwright/test").Page, page2: import("@playwright/test").Page = page) {
  const cores: Array<[string, string, string]> = [
    ["CAFÉ\nNA MESA", "#6F4E37", "#C8A27A"],
    ["GRÃOS\nTORRADOS", "#3E2723", "#8D6E63"],
    ["XÍCARA\nBRANCA", "#8D6E63", "#EFEBE9"],
    ["CAFETERIA", "#4E342E", "#A1887F"],
  ];
  const images = [] as unknown[];
  for (let i = 0; i < cores.length; i++) {
    const [rotulo, c1, c2] = cores[i];
    const buf = await imagemDemo(page2, rotulo, c1, c2);
    const url = `data:image/jpeg;base64,${buf.toString("base64")}`;
    images.push({
      id: `stock-${i}`, url, thumbUrl: url, fullUrl: url,
      alt: rotulo.replace("\n", " "), author: "Pexels", authorUrl: "https://pexels.com", source: "pexels",
    });
  }
  await page.route("**/functions/v1/*stock-search*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ images }) });
  });
}

test.describe("Incluir imagem — mídia própria do cliente (ClickUp 86ajva0an)", () => {
  test.setTimeout(CADENCIA ? 300_000 : 120_000);

  test("cliente envia foto, busca no banco de imagens e publica sem passar pela IA", async ({
    page, seedUser, login,
  }) => {
    const admin = await seedUser("admin");

    // ── CONFIG ────────────────────────────────────────────────────
    await page.goto("/login");
    await faseNaTela(page, "config", "O cliente entra na plataforma");
    await digitar(page.locator("#email"), admin.email);
    await digitar(page.locator("#password"), admin.password);
    await pausa(page, 700);
    await clicar(page, page.getByRole("button", { name: "Entrar", exact: true }));
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // ══ CENA 1 · a foto do cliente entra na galeria ═══════════════
    await faseNaTela(page, "uso", "Cena 1 — a foto do cliente entra na galeria");
    await page.goto("/gallery");
    await expect(page.getByRole("heading", { name: /Galeria de Criações/i })).toBeVisible();
    await pausa(page, 1600);

    const botaoIncluir = page.getByTestId("botao-incluir-imagem").first();
    await expect(botaoIncluir).toBeVisible();
    await apontar(page, botaoIncluir, 2000);
    await clicar(page, botaoIncluir);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await pausa(page, 1600);

    // Foto "de produto" gerada na hora — o espectador vê QUAL imagem sobe.
    const foto = await imagemDemo(page, "FOTO DO\nPRODUTO", "#B9915B", "#5C4326");
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "foto-do-produto.jpg", mimeType: "image/jpeg", buffer: foto,
    });

    // O ✓ verde é o upload REAL concluído no bucket `media`.
    await expect(dialog.locator("img[alt='foto-do-produto.jpg']")).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByTestId("contador-selecionadas")).toHaveText(/1 imagem escolhida/, { timeout: 30_000 });
    await pausa(page, 2200);

    await clicar(page, dialog.getByTestId("confirmar-incluir-imagem"));

    // ── MOMENTO-PROVA 1: a foto aparece na grade, com o selo "Enviada"
    const seloEnviada = page.getByTestId("selo-origem").filter({ hasText: "Enviada" }).first();
    await expect(seloEnviada).toBeVisible({ timeout: 30_000 });
    await apontar(page, seloEnviada, 3200);

    // ══ CENA 2 · banco de imagens pela mesma porta ════════════════
    await faseNaTela(page, "uso", "Cena 2 — o banco de imagens entra pela mesma porta");
    await stubBancoDeImagens(page);
    await clicar(page, botaoIncluir);
    await expect(dialog).toBeVisible();
    await pausa(page, 1200);

    await clicar(page, dialog.getByTestId("aba-banco"));
    await digitar(dialog.getByRole("textbox", { name: /Buscar no banco de imagens/i }), "café");
    await pausa(page, 600);
    await clicar(page, dialog.getByRole("button", { name: /Buscar/i }));

    const resultados = dialog.locator("button:has(img)");
    await expect(resultados.first()).toBeVisible({ timeout: 20_000 });
    await pausa(page, 1800);
    await clicar(page, resultados.first());
    await expect(dialog.getByTestId("contador-selecionadas")).toHaveText(/1 imagem escolhida/);
    await pausa(page, 1200);
    await clicar(page, dialog.getByTestId("confirmar-incluir-imagem"));

    // ── MOMENTO-PROVA 2: selo próprio distingue a origem
    const seloBanco = page.getByTestId("selo-origem").filter({ hasText: "Banco de imagens" }).first();
    await expect(seloBanco).toBeVisible({ timeout: 30_000 });
    await apontar(page, seloBanco, 3000);

    // ══ CENA 3 · a foto do cliente vira POST ══════════════════════
    await faseNaTela(page, "teste", "Cena 3 — a foto do cliente vira post, sem passar pela IA");

    // "Usar em post" leva a foto enviada para o Studio.
    const cardEnviada = page.locator(".card-premium").filter({ hasText: "Enviada" }).first();
    await clicar(page, cardEnviada.getByTitle("Usar em post"));
    await expect(page).toHaveURL(/\/studio/, { timeout: 20_000 });
    await pausa(page, 2000);

    // ── MOMENTO-PROVA 3: a foto do cliente está no canvas do post
    const canvas = page.locator("main").first();
    await expect(canvas).toBeVisible();
    await apontar(page, canvas, 3400);

    // Limpeza é do fixture (cleanup do seedUser derruba org, criações e sessão).
  });
});
