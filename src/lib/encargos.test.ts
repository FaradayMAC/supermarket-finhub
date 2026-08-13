import { describe, expect, it } from "vitest";
import {
  encargosRate,
  ENCARGOS_RATE_LUCRO_REAL,
  ENCARGOS_RATE_SIMPLES,
  FGTS_PCT,
} from "@/lib/encargos";
import { custoReal } from "@/lib/custo-funcionario";

describe("encargosRate", () => {
  it("aplica 68% no lucro real e 28% no Simples", () => {
    expect(encargosRate("lucro_real")).toBe(ENCARGOS_RATE_LUCRO_REAL);
    expect(encargosRate("simples")).toBe(ENCARGOS_RATE_SIMPLES);
    expect(encargosRate(null)).toBe(ENCARGOS_RATE_SIMPLES);
    expect(encargosRate(undefined)).toBe(ENCARGOS_RATE_SIMPLES);
  });

  it("FGTS é 8%", () => {
    expect(FGTS_PCT).toBe(0.08);
  });
});

describe("custoReal — calcula_encargos", () => {
  const base = { salario_base: 2000, dependentes: 0 };

  it("terceirizado (calcula_encargos = false) não soma encargos patronais", () => {
    const c = custoReal({ ...base, calcula_encargos: false });
    expect(c.comEncargos).toBe(false);
    expect(c.rate).toBe(0);
    expect(c.encargos).toBe(0);
    // sem encargos patronais o FGTS entra explicitamente no total
    expect(c.fgtsNoTotal).toBeCloseTo(2000 * FGTS_PCT, 2);
  });

  it("CLT no Simples soma 28% sobre salário + adicionais", () => {
    const c = custoReal({
      ...base,
      calcula_encargos: true,
      lojas: { empresas: { regime_tributario: "simples" } },
    });
    expect(c.rate).toBe(ENCARGOS_RATE_SIMPLES);
    expect(c.encargos).toBeCloseTo(2000 * 0.28, 2);
    // FGTS já embutido na taxa — não é somado de novo
    expect(c.fgtsNoTotal).toBe(0);
  });

  it("CLT no lucro real soma 68%", () => {
    const c = custoReal({
      ...base,
      calcula_encargos: true,
      lojas: { empresas: { regime_tributario: "lucro_real" } },
    });
    expect(c.encargos).toBeCloseTo(2000 * 0.68, 2);
  });
});
