import { describe, it, expect } from "vitest";
import { makeAnonClient } from "./_setup";

/**
 * Edges (social) — portão de auth. Eram 12/13 anon-callable (Denial-of-Wallet: geração
 * paga real). Pós-hardening, NÃO devem executar sem sessão de usuário. Não dependem de
 * secrets de go-live.
 */
const CRITICAL_EDGES = [
  "social_generate-content",
  "social_openai-image",
  "social_ai-assist",
  "social_autopilot-cron",
  "social_brand-suggest",
];

describe("Edges — portão de auth (sem sessão → rejeitado)", () => {
  for (const fn of CRITICAL_EDGES) {
    it(`${fn} rejeita chamada anônima`, async () => {
      const anon = makeAnonClient();
      const { data, error } = await anon.functions.invoke(fn, { body: { probe: true } });
      const rejected = !!error || !data || (data as any)?.ok !== true;
      expect(rejected).toBe(true);
    });
  }
});
