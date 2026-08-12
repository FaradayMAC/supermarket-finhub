// ============================================================================
// Rescisão — simulador de verbas rescisórias (CLT)
// ----------------------------------------------------------------------------
// Regras aplicadas:
// - Saldo de salário: dias trabalhados no mês da data de referência / 30.
// - Aviso prévio indenizado: 30 dias + 3 por ano completo, teto 90 dias
//   (Lei 12.506/2011).
// - Férias vencidas + 1/3: períodos aquisitivos completos não quitados.
// - Férias proporcionais + 1/3: avos do período em curso (>= 15 dias = mês).
// - 13º proporcional: avos do ano corrente (>= 15 dias = mês).
// - FGTS: saldo acumulado + depósito do mês (saldo de salário e aviso prévio).
// - Multa rescisória: 40% (sem justa causa) ou 20% (acordo mútuo).
//
// Tributação (tratamento padrão): saldo de salário e 13º proporcional são
// tributados por INSS/IRRF; aviso prévio indenizado e férias indenizadas
// (vencidas e proporcionais + 1/3) são isentos.
// ============================================================================

import { adicionaisDoCargo, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";
import { adicionaisFonte, type FonteAdicionais } from "@/lib/custo-funcionario";
import { FGTS_PCT } from "@/lib/encargos";
import { calcInss, calcIrrf } from "@/lib/contracheque";

export type TipoRescisao =
  | "sem_justa_causa"
  | "pedido_demissao"
  | "acordo_mutuo"
  | "justa_causa";

export const TIPOS_RESCISAO: { value: TipoRescisao; label: string; descricao: string }[] = [
  {
    value: "sem_justa_causa",
    label: "Dispensa sem justa causa",
    descricao: "Aviso prévio indenizado, multa de 40% do FGTS e verbas proporcionais.",
  },
  {
    value: "pedido_demissao",
    label: "Pedido de demissão",
    descricao: "Sem aviso indenizado e sem multa; verbas proporcionais devidas.",
  },
  {
    value: "acordo_mutuo",
    label: "Acordo mútuo (Lei 13.467/2017)",
    descricao: "Metade do aviso prévio, multa de 20% do FGTS.",
  },
  {
    value: "justa_causa",
    label: "Justa causa",
    descricao: "Somente saldo de salário e férias vencidas.",
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

export function parseDateUTC(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function hojeUTCDate(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

const addMonths = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));

const diffDias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

export type FeriasGozadas = {
  id?: string;
  funcionario_id?: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_inicio_gozo: string;
  dias_gozados: number;
};

export type PeriodoAquisitivo = {
  inicio: Date;
  fim: Date;
  completo: boolean;
  diasGozados: number;
  /** dias de direito ainda em aberto (30 − gozados) para períodos completos */
  diasEmAberto: number;
};

/** Períodos aquisitivos de 12 meses desde a admissão até a data de referência. */
export function periodosAquisitivos(
  dataAdmissao: string | null | undefined,
  ref: Date,
  gozadas: FeriasGozadas[] = [],
): PeriodoAquisitivo[] {
  const adm = parseDateUTC(dataAdmissao);
  if (!adm) return [];
  const out: PeriodoAquisitivo[] = [];
  let inicio = adm;
  let guard = 0;
  while (inicio <= ref && guard++ < 80) {
    const fim = new Date(addMonths(inicio, 12).getTime() - 86400000);
    const completo = fim <= ref;
    const diasGozados = gozadas
      .filter((g) => {
        const gi = parseDateUTC(g.periodo_aquisitivo_inicio);
        return gi ? isoDate(gi) === isoDate(inicio) : false;
      })
      .reduce((s, g) => s + (Number(g.dias_gozados) || 0), 0);
    out.push({
      inicio,
      fim,
      completo,
      diasGozados,
      diasEmAberto: completo ? Math.max(0, 30 - diasGozados) : 0,
    });
    inicio = addMonths(inicio, 12);
  }
  return out;
}

/** Avos: meses completos, contando fração >= 15 dias como mês inteiro. */
export function avos(inicio: Date, fim: Date): number {
  if (fim < inicio) return 0;
  let meses =
    (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    (fim.getUTCMonth() - inicio.getUTCMonth());
  const marco = addMonths(inicio, meses);
  if (marco > fim) {
    meses -= 1;
  }
  const resto = diffDias(addMonths(inicio, Math.max(0, meses)), fim) + 1;
  if (resto >= 15) meses += 1;
  return Math.max(0, Math.min(12, meses));
}

export type FuncionarioRescisao = FonteAdicionais & {
  id?: string;
  nome?: string;
  salario_base: number | string;
  data_admissao?: string | null;
  dependentes?: number | string;
  fgts_saldo_inicial?: number | string | null;
  fgts_saldo_inicial_data?: string | null;
};

/** Remuneração base das verbas: salário + adicionais habituais do cargo. */
export function remuneracaoBase(
  f: FuncionarioRescisao,
  salarioMinimoFederal = SALARIO_MINIMO_FEDERAL,
) {
  const salario = Number(f.salario_base) || 0;
  const adic = adicionaisDoCargo(adicionaisFonte(f), salario, salarioMinimoFederal);
  return { salario, adicionais: adic.total, remuneracao: r2(salario + adic.total), detalhe: adic };
}

/** Provisão de férias (proporcionais + 1/3) do período aquisitivo em curso. */
export function provisaoFerias(
  f: FuncionarioRescisao,
  gozadas: FeriasGozadas[],
  ref: Date = hojeUTCDate(),
  salarioMinimoFederal = SALARIO_MINIMO_FEDERAL,
) {
  const { remuneracao } = remuneracaoBase(f, salarioMinimoFederal);
  const periodos = periodosAquisitivos(f.data_admissao, ref, gozadas);
  const emCurso = periodos.find((p) => !p.completo);
  const meses = emCurso ? avos(emCurso.inicio, ref) : 0;
  const valor = r2((remuneracao / 12) * meses);
  const terco = r2(valor / 3);
  return { meses, valor, terco, total: r2(valor + terco) };
}

/** Provisão de férias vencidas (períodos completos ainda não gozados) + 1/3. */
export function feriasVencidas(
  f: FuncionarioRescisao,
  gozadas: FeriasGozadas[],
  ref: Date = hojeUTCDate(),
  salarioMinimoFederal = SALARIO_MINIMO_FEDERAL,
) {
  const { remuneracao } = remuneracaoBase(f, salarioMinimoFederal);
  const periodos = periodosAquisitivos(f.data_admissao, ref, gozadas).filter((p) => p.completo);
  const dias = periodos.reduce((s, p) => s + p.diasEmAberto, 0);
  const valor = r2((remuneracao / 30) * dias);
  const terco = r2(valor / 3);
  return { dias, periodos, valor, terco, total: r2(valor + terco) };
}

/** Provisão de 13º proporcional do ano corrente. */
export function provisaoDecimoTerceiro(
  f: FuncionarioRescisao,
  ref: Date = hojeUTCDate(),
  salarioMinimoFederal = SALARIO_MINIMO_FEDERAL,
) {
  const { remuneracao } = remuneracaoBase(f, salarioMinimoFederal);
  const adm = parseDateUTC(f.data_admissao);
  const janeiro = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
  const inicio = adm && adm > janeiro ? adm : janeiro;
  const meses = adm && adm > ref ? 0 : avos(inicio, ref);
  const valor = r2((remuneracao / 12) * meses);
  return { meses, valor, total: valor };
}

/** Dias de aviso prévio: 30 + 3 por ano completo, teto 90 (Lei 12.506/2011). */
export function diasAvisoPrevio(dataAdmissao: string | null | undefined, ref: Date): number {
  const adm = parseDateUTC(dataAdmissao);
  if (!adm) return 30;
  let anos =
    (ref.getUTCFullYear() - adm.getUTCFullYear()) * 12 + (ref.getUTCMonth() - adm.getUTCMonth());
  if (ref.getUTCDate() < adm.getUTCDate()) anos -= 1;
  anos = Math.floor(Math.max(0, anos) / 12);
  return Math.min(90, 30 + 3 * anos);
}

export type SaldoFgtsInput = {
  /** Saldo informado manualmente no cadastro (histórico anterior ao sistema). */
  saldoInicial: number;
  /** FGTS mensal já depositado (somatório das competências fechadas). */
  depositos: number;
  /** Saques lançados manualmente. */
  saques: number;
};

export function saldoFgts(i: SaldoFgtsInput) {
  return r2(Math.max(0, (i.saldoInicial || 0) + (i.depositos || 0) - (i.saques || 0)));
}

export type ModalidadeAviso = "indenizado" | "trabalhado";

export type FormaCumprimentoAviso = "reducao_7_dias" | "reducao_2_horas";

export const FORMAS_CUMPRIMENTO_AVISO: {
  value: FormaCumprimentoAviso;
  label: string;
}[] = [
  { value: "reducao_7_dias", label: "Redução de 7 dias corridos ao final do aviso" },
  { value: "reducao_2_horas", label: "Redução de 2 horas na jornada diária (Art. 488 CLT)" },
];

const addDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export type RescisaoInput = {
  tipo: TipoRescisao;
  ref: Date;
  gozadas: FeriasGozadas[];
  fgts: SaldoFgtsInput;
  salarioMinimoFederal?: number;
  /** Modalidade do aviso prévio (padrão: indenizado). */
  modalidadeAviso?: ModalidadeAviso;
};

export function calcRescisao(f: FuncionarioRescisao, i: RescisaoInput) {
  const sm = i.salarioMinimoFederal ?? SALARIO_MINIMO_FEDERAL;
  const { salario, adicionais, remuneracao } = remuneracaoBase(f, sm);
  const ref = i.ref;
  const tipo = i.tipo;

  // 1. Saldo de salário
  const diasTrabalhadosMes = ref.getUTCDate();
  const saldoSalario = r2((remuneracao / 30) * diasTrabalhadosMes);

  // 2. Aviso prévio (indenizado ou trabalhado)
  const modalidadeAviso: ModalidadeAviso = i.modalidadeAviso ?? "indenizado";
  const diasAviso = diasAvisoPrevio(f.data_admissao, ref);
  const diasExcedentes = Math.max(0, diasAviso - 30);
  const fatorAviso = tipo === "sem_justa_causa" ? 1 : tipo === "acordo_mutuo" ? 0.5 : 0;
  const diasAvisoIndenizados = modalidadeAviso === "indenizado" ? diasAviso : diasExcedentes;
  const avisoPrevio = r2((remuneracao / 30) * diasAvisoIndenizados * fatorAviso);

  // Projeção do aviso prévio (Súmula 371 TST): verbas proporcionais contam até
  // a data de referência somada aos dias de aviso, em qualquer modalidade.
  const dataProjetada = fatorAviso > 0 ? addDias(ref, diasAviso) : ref;

  // 3. Férias vencidas + 1/3 (devidas em qualquer tipo)
  const vencidas = feriasVencidas(f, i.gozadas, ref, sm);

  // 4. Férias proporcionais + 1/3 (não devidas na justa causa)
  const propFerias = provisaoFerias(f, i.gozadas, dataProjetada, sm);
  const feriasProporcionais = tipo === "justa_causa" ? { ...propFerias, valor: 0, terco: 0, total: 0 } : propFerias;

  // 5. 13º proporcional (não devido na justa causa)
  const prop13 = provisaoDecimoTerceiro(f, dataProjetada, sm);
  const decimoTerceiro = tipo === "justa_causa" ? { ...prop13, valor: 0, total: 0 } : prop13;

  // 6. FGTS
  const fgtsAcumulado = saldoFgts(i.fgts);
  const fgtsDoMes = r2((saldoSalario + avisoPrevio) * FGTS_PCT);
  const fgtsTotal = r2(fgtsAcumulado + fgtsDoMes);

  // 7. Multa rescisória
  const pctMulta = tipo === "sem_justa_causa" ? 40 : tipo === "acordo_mutuo" ? 20 : 0;
  const multaFgts = r2((fgtsTotal * pctMulta) / 100);

  // FGTS sacável pelo funcionário: integral (sem justa causa), 80% (acordo),
  // e indisponível nos demais casos.
  const pctSaque = tipo === "sem_justa_causa" ? 100 : tipo === "acordo_mutuo" ? 80 : 0;
  const fgtsSacavel = r2((fgtsTotal * pctSaque) / 100);

  // --- Tributação: só saldo de salário e 13º proporcional ---
  const baseInss = r2(saldoSalario);
  const inssSalario = calcInss(baseInss);
  const inss13 = decimoTerceiro.total > 0 ? calcInss(decimoTerceiro.total) : 0;
  const inss = r2(inssSalario + inss13);
  const dependentes = Number(f.dependentes) || 0;
  const irrfSalario = calcIrrf(baseInss, inssSalario, dependentes);
  const irrf13 =
    decimoTerceiro.total > 0 ? calcIrrf(decimoTerceiro.total, inss13, dependentes) : 0;
  const irrf = r2(irrfSalario + irrf13);

  const verbasTributaveis = r2(saldoSalario + decimoTerceiro.total);
  const verbasIndenizadas = r2(
    avisoPrevio + vencidas.total + feriasProporcionais.total,
  );
  const totalBruto = r2(verbasTributaveis + verbasIndenizadas);
  const totalDescontos = r2(inss + irrf);
  const liquidoTrct = r2(totalBruto - totalDescontos);

  // Custo da empresa: verbas + FGTS do mês + multa (a conta vinculada já tinha
  // o saldo acumulado depositado, então ele não é custo novo da rescisão).
  const custoEmpresa = r2(totalBruto + fgtsDoMes + multaFgts);
  const recebidoFuncionario = r2(liquidoTrct + fgtsSacavel + multaFgts);

  return {
    ref,
    tipo,
    salario,
    adicionais,
    remuneracao,
    diasTrabalhadosMes,
    saldoSalario,
    diasAviso,
    diasExcedentes,
    diasAvisoIndenizados,
    modalidadeAviso,
    dataProjetada,
    fatorAviso,
    avisoPrevio,
    vencidas,
    feriasProporcionais,
    decimoTerceiro,
    fgtsAcumulado,
    fgtsDoMes,
    fgtsTotal,
    pctMulta,
    multaFgts,
    pctSaque,
    fgtsSacavel,
    inss,
    irrf,
    verbasTributaveis,
    verbasIndenizadas,
    totalBruto,
    totalDescontos,
    liquidoTrct,
    custoEmpresa,
    recebidoFuncionario,
  };
}

export type Rescisao = ReturnType<typeof calcRescisao>;
