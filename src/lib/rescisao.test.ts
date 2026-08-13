import { describe, expect, it } from "vitest";
import {
  calcRescisao,
  diasAvisoPrevio,
  avos,
  periodosAquisitivos,
  feriasVencidas,
  saldoFgts,
  type FuncionarioRescisao,
} from "@/lib/rescisao";

const f: FuncionarioRescisao = {
  nome: "Teste",
  salario_base: 3000,
  data_admissao: "2020-03-10",
  dependentes: 0,
};

const ref = new Date(Date.UTC(2026, 2, 20)); // 20/03/2026
const fgts = { saldoInicial: 10000, depositos: 0, saques: 0 };
const baseInput = { ref, gozadas: [], fgts };

describe("diasAvisoPrevio — Lei 12.506/2011", () => {
  it("30 dias + 3 por ano completo, teto de 90", () => {
    expect(diasAvisoPrevio("2026-01-01", ref)).toBe(30);
    expect(diasAvisoPrevio("2020-03-10", ref)).toBe(48); // 6 anos completos
    expect(diasAvisoPrevio("1990-01-01", ref)).toBe(90);
  });
});

describe("avos", () => {
  it("fração de 15 dias ou mais conta como mês", () => {
    expect(avos(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 14)))).toBe(0);
    expect(avos(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 15)))).toBe(1);
  });
});

describe("períodos aquisitivos e férias vencidas", () => {
  it("conta períodos completos desde a admissão", () => {
    const p = periodosAquisitivos("2024-03-10", ref);
    expect(p.filter((x) => x.completo).length).toBe(2);
  });

  it("férias já gozadas abatem os dias em aberto", () => {
    const sem = feriasVencidas({ ...f, data_admissao: "2024-03-10" }, [], ref);
    const com = feriasVencidas({ ...f, data_admissao: "2024-03-10" }, [
      {
        periodo_aquisitivo_inicio: "2024-03-10",
        periodo_aquisitivo_fim: "2025-03-09",
        data_inicio_gozo: "2025-06-01",
        dias_gozados: 30,
      },
    ], ref);
    expect(sem.dias).toBe(60);
    expect(com.dias).toBe(30);
    expect(com.total).toBeCloseTo(sem.total / 2, 2);
  });
});

describe("saldoFgts", () => {
  it("saldo inicial + depósitos − saques, nunca negativo", () => {
    expect(saldoFgts({ saldoInicial: 1000, depositos: 500, saques: 200 })).toBe(1300);
    expect(saldoFgts({ saldoInicial: 100, depositos: 0, saques: 900 })).toBe(0);
  });
});

describe("tipos de rescisão", () => {
  it("sem justa causa: aviso indenizado integral e multa de 40%", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "sem_justa_causa" });
    expect(r.fatorAviso).toBe(1);
    expect(r.pctMulta).toBe(40);
    expect(r.pctSaque).toBe(100);
    expect(r.avisoPrevio).toBeGreaterThan(0);
    expect(r.multaFgts).toBeCloseTo((r.fgtsTotal * 40) / 100, 2);
  });

  it("pedido de demissão: sem aviso indenizado e sem multa", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "pedido_demissao" });
    expect(r.avisoPrevio).toBe(0);
    expect(r.multaFgts).toBe(0);
    expect(r.pctSaque).toBe(0);
    expect(r.feriasProporcionais.total).toBeGreaterThanOrEqual(0);
    expect(r.vencidas.total).toBeGreaterThan(0);
  });

  it("acordo mútuo: metade do aviso, multa de 20% e saque de 80%", () => {
    const semJusta = calcRescisao(f, { ...baseInput, tipo: "sem_justa_causa" });
    const acordo = calcRescisao(f, { ...baseInput, tipo: "acordo_mutuo" });
    expect(acordo.fatorAviso).toBe(0.5);
    expect(acordo.avisoPrevio).toBeCloseTo(semJusta.avisoPrevio / 2, 2);
    expect(acordo.pctMulta).toBe(20);
    expect(acordo.pctSaque).toBe(80);
  });

  it("justa causa: só saldo de salário e férias vencidas", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "justa_causa" });
    expect(r.avisoPrevio).toBe(0);
    expect(r.multaFgts).toBe(0);
    expect(r.feriasProporcionais.total).toBe(0);
    expect(r.decimoTerceiro.total).toBe(0);
    expect(r.saldoSalario).toBeGreaterThan(0);
    expect(r.vencidas.total).toBeGreaterThanOrEqual(0);
  });
});

describe("aviso prévio: trabalhado vs. indenizado", () => {
  it("trabalhado indeniza apenas os dias excedentes a 30", () => {
    const ind = calcRescisao(f, {
      ...baseInput,
      tipo: "sem_justa_causa",
      modalidadeAviso: "indenizado",
    });
    const trab = calcRescisao(f, {
      ...baseInput,
      tipo: "sem_justa_causa",
      modalidadeAviso: "trabalhado",
    });
    expect(ind.diasAvisoIndenizados).toBe(ind.diasAviso);
    expect(trab.diasAvisoIndenizados).toBe(trab.diasAviso - 30);
    expect(trab.avisoPrevio).toBeLessThan(ind.avisoPrevio);
  });

  it("projeção da Súmula 371 vale nas duas modalidades", () => {
    const ind = calcRescisao(f, {
      ...baseInput,
      tipo: "sem_justa_causa",
      modalidadeAviso: "indenizado",
    });
    const trab = calcRescisao(f, {
      ...baseInput,
      tipo: "sem_justa_causa",
      modalidadeAviso: "trabalhado",
    });
    expect(ind.dataProjetada.getTime()).toBe(trab.dataProjetada.getTime());
    expect(ind.dataProjetada.getTime()).toBeGreaterThan(ref.getTime());
    expect(ind.decimoTerceiro.meses).toBe(trab.decimoTerceiro.meses);
  });

  it("sem aviso indenizado (pedido de demissão) não há projeção", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "pedido_demissao" });
    expect(r.dataProjetada.getTime()).toBe(ref.getTime());
  });

  it("projeção aumenta os avos das verbas proporcionais", () => {
    // referência em 20/03 projeta para maio → mais um avo de 13º
    const semProjecao = calcRescisao(f, { ...baseInput, tipo: "pedido_demissao" });
    const comProjecao = calcRescisao(f, { ...baseInput, tipo: "sem_justa_causa" });
    expect(comProjecao.decimoTerceiro.meses).toBeGreaterThan(semProjecao.decimoTerceiro.meses);
  });
});

describe("totais da rescisão", () => {
  it("líquido = bruto − INSS/IRRF e custo empresa inclui FGTS do mês + multa", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "sem_justa_causa" });
    expect(r.liquidoTrct).toBeCloseTo(r.totalBruto - r.totalDescontos, 2);
    expect(r.custoEmpresa).toBeCloseTo(r.totalBruto + r.fgtsDoMes + r.multaFgts, 2);
    expect(r.recebidoFuncionario).toBeCloseTo(r.liquidoTrct + r.fgtsSacavel + r.multaFgts, 2);
  });

  it("verbas indenizadas não sofrem INSS/IRRF", () => {
    const r = calcRescisao(f, { ...baseInput, tipo: "sem_justa_causa" });
    expect(r.verbasTributaveis).toBeCloseTo(r.saldoSalario + r.decimoTerceiro.total, 2);
    expect(r.verbasIndenizadas).toBeCloseTo(
      r.avisoPrevio + r.vencidas.total + r.feriasProporcionais.total,
      2,
    );
  });
});
