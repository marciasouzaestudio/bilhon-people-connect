/**
 * Prova — a esteira alcança a coluna "Geradas" (ClickUp 86ajv9b29).
 *
 * O card: "os 5 posts foram criados apenas na coluna Ideias, como rascunho. A
 * coluna Geradas ficou com 0 itens e a mensagem 'Sem posts nesta etapa'. Não
 * existe nenhum botão ou ação que leve um item de Ideias para Geradas."
 *
 * Dois takes, MESMA org e MESMOS posts — é o contraste que prova:
 *   ANTES  → produção (https://bilhon-rs.lovable.app): as ideias ficam paradas,
 *            "Geradas" diz "Sem posts nesta etapa" e não há ação nenhuma.
 *   DEPOIS → este build: "Gerar visuais (2)" existe, roda, e os posts chegam
 *            em "Geradas" COM ARTE — a fase `uso`.
 *
 *   E2E_CADENCIA=1 npx playwright test e2e/esteira-geradas.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import { makeUserInOrg, cleanup, seedUserConfig, app, type OrgUser } from "../tests/integration/_setup";
import { CADENCIA, pausa, digitar, clicar, apontar, faseNaTela } from "./_cadencia";

const PROD = "https://bilhon-rs.lovable.app";

const IDEIAS = [
  "Café coado na hora: o ritual que separa o dia bom do dia corrido.",
  "Grão torrado ontem, moído agora — é isso que muda a sua manhã.",
];

let usuario: OrgUser;
let calendarId: string;

/** Faixa fixa no topo, para o espectador saber QUAL das duas telas está vendo. */
async function rotulo(page: Page, texto: string, cor: string) {
  await page.evaluate(([t, c]) => {
    document.getElementById("__faixa")?.remove();
    const d = document.createElement("div");
    d.id = "__faixa";
    d.textContent = t as string;
    d.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:2147483647;background:${c};
      color:#fff;font:600 17px/2.3 system-ui,sans-serif;text-align:center;letter-spacing:.01em`;
    document.body.appendChild(d);
  }, [texto, cor]);
  await pausa(page, 900);
}

async function entrar(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await digitar(page.locator("#email"), usuario.email);
  await digitar(page.locator("#password"), usuario.password);
  await pausa(page, 600);
  await clicar(page, page.getByRole("button", { name: "Entrar", exact: true }));
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 });
}

/** Lê o número que a coluna mostra no cabeçalho — é o que medimos antes e depois. */
async function contarNaColuna(page: Page, titulo: string): Promise<number> {
  const col = page.locator("div").filter({ hasText: new RegExp(`^${titulo}`) }).first();
  const txt = (await col.innerText().catch(() => "")) || "";
  const m = txt.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

test.beforeAll(async () => {
  usuario = await makeUserInOrg({ role: "admin" });
  await seedUserConfig(usuario.orgId, usuario.userId, {
    onboarding_completed: true,
    brand_name: "Café Lendário",
  });
  const { data: marca } = await app().from("brand_profiles")
    .insert({ org_id: usuario.orgId, user_id: usuario.userId, name: "Café Lendário" })
    .select("id").single();
  const { data: cfg } = await app().from("autopilot_configs").insert({
    org_id: usuario.orgId, user_id: usuario.userId, brand_id: marca!.id,
    platforms: ["instagram"], posts_per_cycle: 2, visual_format: "image",
    image_provider: "openai", recurrence: "weekly", requires_approval: true,
    is_active: true, timezone: "America/Sao_Paulo",
  }).select("id").single();
  const { data: cal } = await app().from("autopilot_calendars").insert({
    org_id: usuario.orgId, user_id: usuario.userId, config_id: cfg!.id, status: "draft",
    cycle_start: new Date().toISOString().slice(0, 10),
    cycle_end: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  }).select("id").single();
  calendarId = cal!.id;

  // O estado EXATO do report: ideias criadas como rascunho, sem arte nenhuma.
  for (let i = 0; i < IDEIAS.length; i++) {
    await app().from("autopilot_posts").insert({
      org_id: usuario.orgId, user_id: usuario.userId, calendar_id: calendarId,
      platform: "instagram", text_content: IDEIAS[i], status: "draft",
      visual_format: "image", scheduled_at: new Date(Date.now() + (i + 1) * 864e5).toISOString(),
    });
  }
});

test.afterAll(async () => {
  await cleanup(usuario);
});

test.describe("Esteira do Autopilot alcança a coluna Geradas (ClickUp 86ajv9b29)", () => {
  test.setTimeout(CADENCIA ? 420_000 : 180_000);

  test("ANTES — em produção as ideias ficam paradas e não há ação para avançar", async ({ page }) => {
    await entrar(page, PROD);
    await rotulo(page, "ANTES · produção hoje · as ideias não saem do lugar", "#b91c1c");

    await faseNaTela(page, "uso", "O cliente abre o Autopilot depois de gerar o ciclo");
    await page.goto(`${PROD}/autopilot`);
    await rotulo(page, "ANTES · produção hoje · as ideias não saem do lugar", "#b91c1c");
    await pausa(page, 2400);

    const ideias = page.getByText("Ideias", { exact: true }).first();
    await apontar(page, ideias, 2600);

    // ── MOMENTO-PROVA 1: a coluna Geradas está vazia e diz isso
    const vazio = page.getByText("Sem posts nesta etapa").first();
    await expect(vazio).toBeVisible({ timeout: 20_000 });
    await apontar(page, vazio, 3600);

    // ── MOMENTO-PROVA 2: não existe botão para gerar as peças
    await expect(page.getByRole("button", { name: /Gerar visuais/i })).toHaveCount(0);
    await rotulo(page, "ANTES · nenhum botão leva de Ideias para Geradas", "#b91c1c");
    await pausa(page, 3200);
  });

  test("DEPOIS — 'Gerar visuais' leva as ideias até Geradas, com arte", async ({ page }) => {
    await entrar(page, "");
    await rotulo(page, "DEPOIS · build corrigido · mesma org, mesmos posts", "#15803d");

    await faseNaTela(page, "uso", "A mesma tela, agora com a etapa que faltava");
    await page.goto("/autopilot");
    await rotulo(page, "DEPOIS · build corrigido · mesma org, mesmos posts", "#15803d");
    await pausa(page, 2200);

    const geradasAntes = await contarNaColuna(page, "Geradas");
    console.log(`[prova] Geradas antes do clique: ${geradasAntes}`);

    // ── MOMENTO-PROVA 1: o botão que não existia
    const botao = page.getByRole("button", { name: /Gerar visuais/i });
    await expect(botao).toBeVisible({ timeout: 20_000 });
    await apontar(page, botao, 3000);
    await clicar(page, botao);

    await rotulo(page, "DEPOIS · gerando a peça visual de verdade (leva ~1min)", "#15803d");

    // ── MOMENTO-PROVA 2: os posts CHEGAM em Geradas, com arte
    const comArte = page.locator("img[src*='/storage/v1/object/public/media/autopilot/']");
    await expect(comArte.first()).toBeVisible({ timeout: 240_000 });
    await pausa(page, 1800);
    await expect(comArte).toHaveCount(IDEIAS.length, { timeout: 240_000 });

    const geradasDepois = await contarNaColuna(page, "Geradas");
    console.log(`[prova] Geradas depois do clique: ${geradasDepois}`);

    await rotulo(page, `DEPOIS · Geradas: ${geradasAntes} → ${geradasDepois}, com arte`, "#15803d");
    await apontar(page, comArte.first(), 4200);

    // E a esteira segue: com arte pronta, a aprovação passa a ser oferecida.
    await expect(page.getByRole("button", { name: /Aprovar tudo/i })).toBeVisible({ timeout: 20_000 });
    await apontar(page, page.getByRole("button", { name: /Aprovar tudo/i }), 3000);
  });
});
