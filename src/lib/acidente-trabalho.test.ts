import { describe, expect, it } from "vitest";
import {
  diasPagosEmpresa,
  fimEstabilidadeAcidente,
  situacaoAcidente,
} from "./situacao-funcionario";

describe("acidente de trabalho", () => {
  it("empresa nunca paga mais de 15 dias de atestado", () => {
    expect(diasPagosEmpresa(17)).toBe(15);
    expect(diasPagosEmpresa(10)).toBe(10);
    expect(diasPagosEmpresa(0)).toBe(0);
  });

  it("estabilidade termina 12 meses após o retorno", () => {
    expect(fimEstabilidadeAcidente("2026-03-10")).toBe("2027-03-10");
  });

  it("sem retorno, situação é afastado por acidente", () => {
    const r = situacaoAcidente([{ data_inicio: "2026-08-01", dias_atestado: 17 }], "2026-08-13");
    expect(r?.situacao).toBe("Afastado (Acidente de Trabalho)");
  });

  it("com retorno dentro de 12 meses, situação é estabilidade", () => {
    const r = situacaoAcidente(
      [{ data_inicio: "2026-01-05", dias_atestado: 20, data_retorno: "2026-02-01" }],
      "2026-08-13",
    );
    expect(r?.situacao).toBe("Estabilidade (acidente de trabalho)");
    expect(r?.fimEstabilidade).toBe("2027-02-01");
  });

  it("após 12 meses do retorno não há mais estabilidade", () => {
    expect(
      situacaoAcidente(
        [{ data_inicio: "2024-01-05", dias_atestado: 20, data_retorno: "2024-02-01" }],
        "2026-08-13",
      ),
    ).toBeNull();
  });
});
