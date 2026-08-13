import { describe, expect, it } from "vitest";
import {
  calcSalarioFamilia,
  SALARIO_FAMILIA_COTA,
  SALARIO_FAMILIA_TETO,
} from "@/lib/salario-familia";

describe("calcSalarioFamilia", () => {
  it("paga cota por dependente dentro do teto", () => {
    expect(calcSalarioFamilia(1500, 1)).toBeCloseTo(SALARIO_FAMILIA_COTA, 2);
    expect(calcSalarioFamilia(1500, 3)).toBeCloseTo(SALARIO_FAMILIA_COTA * 3, 2);
  });

  it("zera acima do teto (borda exata)", () => {
    expect(calcSalarioFamilia(SALARIO_FAMILIA_TETO, 2)).toBeCloseTo(SALARIO_FAMILIA_COTA * 2, 2);
    expect(calcSalarioFamilia(SALARIO_FAMILIA_TETO + 0.01, 2)).toBe(0);
  });

  it("sem dependentes não há benefício", () => {
    expect(calcSalarioFamilia(1500, 0)).toBe(0);
    expect(calcSalarioFamilia(1500, -3)).toBe(0);
  });

  it("valores 2026 vigentes", () => {
    expect(SALARIO_FAMILIA_COTA).toBe(67.54);
    expect(SALARIO_FAMILIA_TETO).toBe(1980.38);
  });
});
