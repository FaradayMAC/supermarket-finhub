import { describe, expect, it } from "vitest";
import {
  planosDoFuncionario,
  temDireitoAosPlanos,
  valorPlanoSaude,
  idadeNaCompetencia,
  referenciaCompetencia,
  type PlanosConfig,
} from "@/lib/planos";

const config: PlanosConfig = { odontologico: 30, saudeFaixa1: 200, saudeFaixa2: 350 };

describe("carência de 3 meses", () => {
  it("não tem direito antes de completar 3 meses", () => {
    expect(temDireitoAosPlanos("2026-01-15", new Date(Date.UTC(2026, 3, 14)))).toBe(false);
  });

  it("tem direito exatamente no dia em que completa 3 meses", () => {
    expect(temDireitoAosPlanos("2026-01-15", new Date(Date.UTC(2026, 3, 15)))).toBe(true);
  });

  it("sem data de admissão não há direito", () => {
    expect(temDireitoAosPlanos(null, new Date(Date.UTC(2026, 3, 15)))).toBe(false);
  });
});

describe("faixa etária do plano de saúde", () => {
  it("43 anos usa faixa 1 e 44 anos usa faixa 2", () => {
    expect(valorPlanoSaude(config, 43)).toBe(200);
    expect(valorPlanoSaude(config, 44)).toBe(350);
    expect(valorPlanoSaude(config, null)).toBe(200);
  });

  it("idade é calculada na competência", () => {
    const ref = referenciaCompetencia("2026-06"); // 30/06/2026
    expect(idadeNaCompetencia("1982-06-30", ref)).toBe(44);
    expect(idadeNaCompetencia("1982-07-01", ref)).toBe(43);
  });
});

describe("planosDoFuncionario", () => {
  it("zera os valores durante a carência e informa dias restantes", () => {
    const r = planosDoFuncionario(
      { data_admissao: "2026-01-15", data_nascimento: "1990-01-01" },
      config,
      new Date(Date.UTC(2026, 3, 10)),
    );
    expect(r.elegivel).toBe(false);
    expect(r.planoSaude).toBe(0);
    expect(r.planoOdonto).toBe(0);
    expect(r.diasParaCarencia).toBe(5);
  });

  it("aplica faixa 2 após a carência para 44+", () => {
    const r = planosDoFuncionario(
      { data_admissao: "2025-01-15", data_nascimento: "1970-01-01" },
      config,
      new Date(Date.UTC(2026, 5, 30)),
    );
    expect(r.elegivel).toBe(true);
    expect(r.planoSaude).toBe(350);
    expect(r.planoOdonto).toBe(30);
  });
});
