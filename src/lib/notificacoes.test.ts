import { describe, it, expect } from "vitest";
import { notificacoesDoDia, filtrarNaoLidas, diaLocal } from "./notificacoes";

const f = (over: Partial<any> = {}) => ({
  id: "1",
  nome: "João",
  data_admissao: "2026-01-10",
  data_fim_experiencia: "2026-04-10",
  data_desligamento: null,
  ...over,
});

describe("notificacoesDoDia", () => {
  it("avisa no dia exato dos 3 meses", () => {
    const n = notificacoesDoDia([f()], diaLocal("2026-04-10"));
    expect(n.some((x) => x.tipo === "plano_saude")).toBe(true);
  });

  it("não repete depois dos 3 meses", () => {
    const n = notificacoesDoDia([f()], diaLocal("2026-04-11"));
    expect(n.some((x) => x.tipo === "plano_saude")).toBe(false);
  });

  it("avisa 5 dias antes do fim do 1º contrato (45 dias)", () => {
    // 2026-01-10 + 45 = 2026-02-24 → alerta em 2026-02-19
    const n = notificacoesDoDia([f({ data_fim_experiencia: null })], diaLocal("2026-02-19"));
    expect(n.map((x) => x.tipo)).toEqual(["fim_1o_contrato_experiencia"]);
  });

  it("avisa 5 dias antes do fim da experiência de 90 dias", () => {
    const n = notificacoesDoDia([f()], diaLocal("2026-04-05"));
    expect(n.map((x) => x.tipo)).toEqual(["fim_2o_contrato_experiencia"]);
  });

  it("ignora desligados", () => {
    const n = notificacoesDoDia([f({ data_desligamento: "2026-03-01" })], diaLocal("2026-04-10"));
    expect(n).toHaveLength(0);
  });
});

describe("filtrarNaoLidas", () => {
  it("remove as já resolvidas", () => {
    const todas = notificacoesDoDia([f()], diaLocal("2026-04-10"));
    const rest = filtrarNaoLidas(todas, [
      { funcionario_id: "1", tipo: "plano_saude", data_evento: "2026-04-10" },
    ]);
    expect(rest).toHaveLength(0);
  });
});
