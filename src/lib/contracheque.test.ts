import { describe, expect, it } from "vitest";
import {
  calcInss,
  calcIrrf,
  redutorIrrf2026,
  calcContracheque,
  semanasComFaltaInjustificada,
  diasPagosNoAfastamento,
  calendarioMes,
  avos13,
} from "@/lib/contracheque";

describe("calcInss — tabela 2026", () => {
  it("primeira faixa (7,5%) no teto do salário mínimo de 2026", () => {
    // salário mínimo 2026 = R$ 1.621,00 (tabela de 2025 tinha teto de faixa 1.518,00)
    expect(calcInss(1621)).toBeCloseTo(121.57, 2);
    expect(calcInss(1621.01)).toBeGreaterThanOrEqual(calcInss(1621));
  });

  it("é progressivo faixa a faixa", () => {
    expect(calcInss(2902.84)).toBeCloseTo(236.94, 2);
    expect(calcInss(4354.27)).toBeCloseTo(411.11, 2);
  });

  it("trava no teto previdenciário de R$ 8.475,55", () => {
    const teto = calcInss(8475.55);
    expect(teto).toBeCloseTo(988.09, 2);
    expect(calcInss(20000)).toBeCloseTo(teto, 2);
  });

  it("base zero não gera contribuição", () => {
    expect(calcInss(0)).toBe(0);
  });
});

// ============================================================================
// IRRF — Cálculo e redutor (Lei 15.270/2025, vigente desde jan/2026)
// ----------------------------------------------------------------------------
// PASSO A PASSO de calcIrrf(baseBruta, inss, dependentes, rendimentoTributavel):
//
//   1. Base de cálculo = baseBruta - INSS - (dependentes × R$ 189,59)
//      -> nunca negativa (Math.max(0, ...)).
//
//   2. Aplica a tabela progressiva mensal (Lei 15.191/2025):
//        até R$ 2.428,80   → isenta        (0%)
//        até R$ 2.826,65   → 7,5%  (deduz R$ 182,16)
//        até R$ 3.751,05   → 15%   (deduz R$ 394,16)
//        até R$ 4.664,68   → 22,5% (deduz R$ 675,49)
//        acima             → 27,5% (deduz R$ 908,73)
//      Resultado = max(0, base×alíquota - dedução)  =>  "irrfTabela".
//
//   3. REDUTOR da Lei 15.270/2025 (Tabela de Redução Mensal RFB), aplicado sobre
//      o rendimento tributável (rendimentoTributavel, default = baseBruta):
//        a) até R$ 5.000,00       → isenção PLENA: o redutor cancela TODO o
//           irrfTabela, deixando o líquido exatamente em zero. Aqui o redutor
//           não é o valor fixo R$ 312,89 da tabela RFB — ele é igualado ao
//           próprio imposto calculado, garantindo isenção integral em qualquer
//           faixa (com ou sem dependentes).
//        b) R$ 5.000,01 a R$ 7.350,00 → redução DECRESCENTE linear:
//              redutor = max(0, 978,62 - 0,133145 × rendimento)
//           O redutor diminui à medida que a renda sobe e zera em R$ 7.350,00.
//        c) acima de R$ 7.350,00  → sem redutor (0); paga-se a tabela cheia.
//
//   4. Líquido = round(max(0, irrfTabela - redutor)).
//
// OBSERVAÇÃO: o redutor fixo R$ 312,89 que aparece em redutorIrrf2026() só é
// relevante no trecho de redução decrescente (b); na faixa de isenção plena
// (a) o calcIrrf iguala o redutor ao próprio imposto, de modo que salários de
// R$ 4.500 ou R$ 5.000 fiquem ambos em zero mesmo quando a tabela apontaria
// alíquota de 15% ou 22,5%.
// ============================================================================
describe("redutor do IRRF — Lei 15.270/2025", () => {
  it("isenção plena até R$ 5.000, deixando o imposto exatamente em zero", () => {
    // Na faixa de isenção plena o redutor cancela INTEGRALMENTE o irrfTabela,
    // independentemente de dependentes. O valor 312.89 abaixo é só o piso da
    // tabela RFB — o que importa é que calcIrrf zera o líquido.
    expect(redutorIrrf2026(5000)).toBe(312.89);
    const inss = calcInss(5000);
    expect(calcIrrf(5000, inss, 0)).toBe(0);
    expect(calcIrrf(5000, inss, 1)).toBe(0);
    // salários abaixo do teto de R$ 5.000 também ficam isentos
    expect(calcIrrf(4500, calcInss(4500), 0)).toBe(0);
    // fronteiras das faixas dentro do teto de isenção — todas zeram
    expect(calcIrrf(2428.8, calcInss(2428.8), 0)).toBe(0); // fim da isenção-base
    expect(calcIrrf(2826.65, calcInss(2826.65), 0)).toBe(0); // fim faixa 7,5%
    expect(calcIrrf(3751.05, calcInss(3751.05), 0)).toBe(0); // fim faixa 15%
    expect(calcIrrf(4664.68, calcInss(4664.68), 0)).toBe(0); // fim faixa 22,5%
  });

  it("reduz de forma decrescente entre R$ 5.000,01 e R$ 7.350", () => {
    // Faixa (b): redutor = max(0, 978,62 - 0,133145 × rendimento), decrescente.
    const r6000 = redutorIrrf2026(6000);
    const r7000 = redutorIrrf2026(7000);
    expect(r6000).toBeGreaterThan(r7000); // quanto maior a renda, menor o redutor
    expect(r7000).toBeGreaterThan(0); // ainda há redução em R$ 7.000
  });

  it("acaba acima de R$ 7.350", () => {
    // Faixa (c): sem redutor, paga-se a tabela progressiva cheia.
    expect(redutorIrrf2026(7350.01)).toBe(0);
    expect(calcIrrf(9000, calcInss(9000), 0)).toBeGreaterThan(0);
  });

  it("dependentes reduzem a base", () => {
    // Cada dependente abate R$ 189,59 da base antes de aplicar a tabela.
    const inss = calcInss(9000);
    expect(calcIrrf(9000, inss, 2)).toBeLessThan(calcIrrf(9000, inss, 0));
  });
});

describe("semanasComFaltaInjustificada", () => {
  it("conta uma perda de DSR por semana, não por falta", () => {
    // 03, 04 e 05/03/2026 = terça, quarta e quinta da mesma semana
    const faltas = [
      { data: "2026-03-03", tipo: "injustificada" },
      { data: "2026-03-04", tipo: "injustificada" },
      { data: "2026-03-05", tipo: "injustificada" },
    ];
    expect(semanasComFaltaInjustificada(faltas, "2026-03")).toBe(1);
  });

  it("semanas diferentes somam DSR", () => {
    const faltas = [
      { data: "2026-03-03", tipo: "injustificada" },
      { data: "2026-03-11", tipo: "injustificada" },
    ];
    expect(semanasComFaltaInjustificada(faltas, "2026-03")).toBe(2);
  });

  it("falta justificada não derruba o DSR", () => {
    expect(
      semanasComFaltaInjustificada([{ data: "2026-03-03", tipo: "justificada" }], "2026-03"),
    ).toBe(0);
  });
});

describe("diasPagosNoAfastamento — 15 dias da empresa", () => {
  it("empresa paga só os 15 primeiros dias do afastamento", () => {
    const dias = diasPagosNoAfastamento("2026-03", { data_inicio: "2026-03-01" }, 31);
    expect(dias).toBe(15);
  });

  it("dias trabalhados antes do afastamento continuam pagos", () => {
    const dias = diasPagosNoAfastamento("2026-03", { data_inicio: "2026-03-10" }, 31);
    expect(dias).toBe(9 + 15);
  });

  it("afastamento iniciado em competência anterior zera o pagamento da empresa", () => {
    expect(diasPagosNoAfastamento("2026-03", { data_inicio: "2026-01-05" }, 31)).toBe(0);
  });
});

const func = {
  salario_base: 3000,
  vale_transporte: 200,
  vale_alimentacao: 150,
  dependentes: 0,
  data_admissao: "2020-01-02",
};

describe("calcContracheque — faltas", () => {
  it("desconta o dia e o DSR da semana (não proporcional por falta)", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [
        { data: "2026-03-03", tipo: "injustificada" },
        { data: "2026-03-04", tipo: "injustificada" },
      ],
      convenio: 0,
    });
    expect(cc.faltas).toBe(2);
    expect(cc.dsrDias).toBe(1);
    expect(cc.descFaltas).toBeCloseTo((3000 / 30) * 2, 2);
    expect(cc.descDsr).toBeCloseTo(3000 / 30, 2);
  });

  it("vale-transporte não é reduzido por faltas", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [{ data: "2026-03-03", tipo: "injustificada" }],
      convenio: 0,
    });
    expect(cc.descVtBeneficio).toBe(0);
    expect(cc.vtLiquido).toBe(200);
  });

  it("convênio da loja entra como desconto", () => {
    const cc = calcContracheque(func, { mes: "2026-03", faltas: [], convenio: 120 });
    expect(cc.convenio).toBe(120);
    expect(cc.totalDescontos).toBeCloseTo(cc.inss + cc.irrf + 120, 2);
  });

  it("planos de saúde e odonto são benefícios, não descontos", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [],
      convenio: 0,
      planos: { odontologico: 30, saudeFaixa1: 200, saudeFaixa2: 350 },
    });
    expect(cc.planoSaude).toBe(200);
    expect(cc.totalDescontos).toBeCloseTo(cc.inss + cc.irrf, 2);
  });
});

describe("calcContracheque — férias com abono pecuniário", () => {
  it("paga 1/3 sobre os dias gozados e o abono dos dias vendidos + 1/3", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [],
      convenio: 0,
      ferias: { dias_gozados: 20, dias_vendidos: 10 },
    });
    expect(cc.emFerias).toBe(true);
    expect(cc.diasFerias).toBe(20);
    expect(cc.diasVendidos).toBe(10);
    expect(cc.feriasTerco).toBeCloseTo(((3000 / 30) * 20) / 3, 2);
    expect(cc.abonoTotal).toBeCloseTo((3000 / 30) * 10 * (4 / 3), 2);
  });

  it("limita o abono a 10 dias (CLT Art. 143)", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [],
      convenio: 0,
      ferias: { dias_gozados: 20, dias_vendidos: 25 },
    });
    expect(cc.diasVendidos).toBe(10);
  });
});

describe("calcContracheque — afastamento INSS", () => {
  it("desconta os dias além dos 15 pagos pela empresa", () => {
    const cc = calcContracheque(func, {
      mes: "2026-03",
      faltas: [],
      convenio: 0,
      afastamento: { data_inicio: "2026-03-01", tipo: "doenca" },
    });
    const { diasNoMes } = calendarioMes("2026-03");
    expect(cc.afastado).toBe(true);
    expect(cc.diasPagosEmpresa).toBe(15);
    expect(cc.diasSemPagamento).toBe(diasNoMes - 15);
    expect(cc.descAfastamento).toBeGreaterThan(0);
    expect(cc.liquido).toBeLessThan(
      calcContracheque(func, { mes: "2026-03", faltas: [], convenio: 0 }).liquido,
    );
  });
});

describe("calcContracheque — 13º parcelado", () => {
  it("não paga 13º em meses comuns", () => {
    const cc = calcContracheque(func, { mes: "2026-06", faltas: [], convenio: 0 });
    expect(cc.decimoNoMes).toBe(0);
  });

  it("novembro paga a 1ª parcela, isenta de INSS/IRRF", () => {
    const cc = calcContracheque(func, { mes: "2026-11", faltas: [], convenio: 0 });
    // admitido em 2020 → 11 avos em novembro; 1ª parcela = metade
    expect(cc.decimoNoMes).toBeCloseTo(1375, 2);
    expect(cc.inss13).toBe(0);
    expect(cc.irrf13).toBe(0);
  });

  it("dezembro paga a 2ª parcela e tributa o total do ano", () => {
    const cc = calcContracheque(func, { mes: "2026-12", faltas: [], convenio: 0 });
    expect(cc.decimoTotalAno).toBeCloseTo(3000, 2);
    expect(cc.decimoSegundaParcela).toBeCloseTo(3000 - 1375, 2);
    expect(cc.inss13).toBeCloseTo(calcInss(3000), 2);
  });

  it("avos de 13º respeitam a data de admissão", () => {
    expect(avos13("2026-07-10", "2026-12")).toBe(6);
    expect(avos13("2026-07-20", "2026-12")).toBe(5);
    expect(avos13("2020-01-02", "2026-12")).toBe(12);
  });
});
