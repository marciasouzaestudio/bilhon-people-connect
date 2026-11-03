import { describe, it, expect } from "vitest";
import { FONT_OPTIONS, SNAP } from "./types";

describe("studio types", () => {
  // Radix <Select.Item> proíbe value="" — regressão do crash do inspetor.
  it("FONT_OPTIONS não tem value vazio", () => {
    expect(FONT_OPTIONS.length).toBeGreaterThan(0);
    for (const f of FONT_OPTIONS) {
      expect(f.value).toBeTruthy();
      expect(f.value).not.toBe("");
    }
  });

  it("SNAP é um limiar positivo", () => {
    expect(SNAP).toBeGreaterThan(0);
  });
});
