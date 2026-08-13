import { describe, it, expect } from "vitest";
import { verificarLimiteCid, type AtestadoMedico } from "./notificacoes";

const a = (data_inicio: string, dias: number, cid = "M54.5"): AtestadoMedico => ({
  funcionario_id: "1",
  data_inicio,
  dias,
  cid,
});

describe("verificarLimiteCid", () => {
  it("não alerta com 15 dias ou menos", () => {
    expect(verificarLimiteCid([a("2026-01-01", 10), a("2026-01-20", 5)])).toHaveLength(0);
  });

  it("alerta quando o mesmo CID passa de 15 dias em 60 dias", () => {
    const r = verificarLimiteCid([a("2026-01-01", 10), a("2026-02-01", 6)], { "1": "João" });
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe("limite_cid_inss");
    expect(r[0].mensagem).toContain("16 dias");
    expect(r[0].data_evento).toBe("2026-02-01");
  });

  it("dispara só uma vez por grupo", () => {
    const r = verificarLimiteCid([a("2026-01-01", 10), a("2026-01-10", 8), a("2026-01-20", 3)]);
    expect(r).toHaveLength(1);
  });

  it("não soma CIDs diferentes", () => {
    expect(verificarLimiteCid([a("2026-01-01", 10), a("2026-01-05", 10, "J11")])).toHaveLength(0);
  });

  it("reinicia a janela após 60 dias", () => {
    const r = verificarLimiteCid([a("2026-01-01", 10), a("2026-06-01", 10)]);
    expect(r).toHaveLength(0);
  });
});
