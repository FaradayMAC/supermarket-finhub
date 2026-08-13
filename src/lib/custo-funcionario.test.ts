import { describe, expect, it } from "vitest";
import { adicionaisFonte, regimeDoFuncionario, custoReal } from "@/lib/custo-funcionario";
import { QUEBRA_CAIXA_PCT, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";

describe("adicionaisFonte — cargo é a fonte única", () => {
  it("usa os adicionais do cargo quando há cargo vinculado", () => {
    const a = adicionaisFonte({
      cargo_id: "c1",
      tem_periculosidade: true,
      tem_quebra_caixa: false,
      cargos: { tem_periculosidade: false, tem_quebra_caixa: true, motivo_insalubridade: "nenhum" },
    });
    expect(a.tem_periculosidade).toBe(false);
    expect(a.tem_quebra_caixa).toBe(true);
  });

  it("ignora os campos do funcionário quando o cargo não foi carregado", () => {
    const a = adicionaisFonte({ cargo_id: "c1", tem_quebra_caixa: true });
    expect(a.tem_quebra_caixa).toBe(false);
  });

  it("usa os campos do próprio funcionário no caso avulso (sem cargo)", () => {
    const a = adicionaisFonte({ cargo_id: null, tem_quebra_caixa: true });
    expect(a.tem_quebra_caixa).toBe(true);
  });
});

describe("regimeDoFuncionario", () => {
  it("vem da empresa dona da loja", () => {
    expect(regimeDoFuncionario({ lojas: { empresas: { regime_tributario: "lucro_real" } } })).toBe(
      "lucro_real",
    );
    expect(regimeDoFuncionario({})).toBe("simples");
  });
});

describe("custoReal", () => {
  it("adicionais avulsos entram no custo", () => {
    const c = custoReal({ salario_base: 2000, tem_quebra_caixa: true, calcula_encargos: false });
    expect(c.adicionais).toBeCloseTo((SALARIO_MINIMO_FEDERAL * QUEBRA_CAIXA_PCT) / 100, 2);
  });

  it("provisões mensais não são acumulativas (1/12 de férias+1/3 e de 13º)", () => {
    const c = custoReal({ salario_base: 1200, calcula_encargos: false });
    expect(c.prov13Mes).toBeCloseTo(100, 2);
    expect(c.provFeriasMes).toBeCloseTo((1200 / 12) * (4 / 3), 2);
    expect(c.provisoesMensais).toBeCloseTo(c.prov13Mes + c.provFeriasMes, 2);
  });

  it("total soma salário, benefícios, encargos e provisões", () => {
    const c = custoReal({
      salario_base: 2000,
      vale_transporte: 100,
      vale_alimentacao: 150,
      calcula_encargos: false,
    });
    expect(c.total).toBeCloseTo(
      c.salario + c.adicionais + c.fgtsNoTotal + c.vt + c.va + c.sf + c.ve + c.provisoesMensais,
      2,
    );
  });
});
