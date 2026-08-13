import { adicionaisDoCargo, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";
import { adicionaisFonte, type FonteAdicionais } from "@/lib/custo-funcionario";
import { FGTS_PCT } from "@/lib/encargos";
import { calcSalarioFamilia } from "@/lib/salario-familia";
import {
  planosDoFuncionario,
  PLANOS_CONFIG_ZERO,
  referenciaCompetencia,
  type PlanosConfig,
} from "@/lib/planos";


// ============================================================================
// Cálculo do contracheque — legislação trabalhista aplicada ao Espírito Santo
// ----------------------------------------------------------------------------
// Regras aplicadas:
// - Falta injustificada: desconto do dia (salário + adicionais) / 30.
// - DSR (Lei 605/49): perde-se o repouso semanal remunerado da semana em que
//   houve falta. Cálculo proporcional usual:
//     DSR = (faltas / dias úteis do mês) * dias de repouso (domingos + feriados)
//   Feriados considerados: nacionais + estaduais/ES (Colonização do Solo
//   Espírito-santense em 23/05 e Nossa Senhora da Penha, 8 dias após a Páscoa).
// - Verbas variáveis/benefícios (vale-alimentação, vale-transporte, valor extra)
//   são reduzidos proporcionalmente aos dias não trabalhados.
// - Descontos legais: INSS progressivo, IRRF, VT (até 6% do salário base),
//   plano de saúde, plano odontológico e convênio (compras na loja).
// ============================================================================

export type FeriadoInfo = { dia: number; nome: string };

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const key = (d: Date) => `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;

/** Feriados nacionais + estaduais do Espírito Santo para o ano informado. */
export function feriadosES(year: number): Map<string, string> {
  const p = easterSunday(year);
  const map = new Map<string, string>([
    ["1-1", "Confraternização Universal"],
    ["4-21", "Tiradentes"],
    ["5-1", "Dia do Trabalho"],
    ["5-23", "Colonização do Solo Espírito-santense (ES)"],
    ["9-7", "Independência"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-2", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Consciência Negra"],
    ["12-25", "Natal"],
  ]);
  map.set(key(addDays(p, -47)), "Carnaval");
  map.set(key(addDays(p, -2)), "Sexta-feira Santa");
  map.set(key(addDays(p, 8)), "Nossa Senhora da Penha (ES)");
  map.set(key(addDays(p, 60)), "Corpus Christi");
  return map;
}

export type CalendarioMes = {
  diasNoMes: number;
  diasUteis: number;
  diasRepouso: number;
  feriados: FeriadoInfo[];
};

/** mes no formato YYYY-MM */
export function calendarioMes(mes: string): CalendarioMes {
  const [y, m] = mes.split("-").map(Number);
  const year = y || new Date().getFullYear();
  const month = m || 1;
  const feriadosMap = feriadosES(year);
  const diasNoMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let diasUteis = 0;
  let diasRepouso = 0;
  const feriados: FeriadoInfo[] = [];
  for (let d = 1; d <= diasNoMes; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const nomeFeriado = feriadosMap.get(key(date));
    const domingo = date.getUTCDay() === 0;
    if (nomeFeriado) feriados.push({ dia: d, nome: nomeFeriado });
    if (domingo || nomeFeriado) diasRepouso++;
    else diasUteis++;
  }
  return { diasNoMes, diasUteis, diasRepouso, feriados };
}

// --- Tabelas oficiais (INSS / IRRF) — vigentes desde jan/2026 -------------
// INSS: Portaria Interministerial MPS/MF nº 13/2026 (salário mínimo R$ 1.621,00)
const INSS_FAIXAS = [
  { ate: 1621.0, aliq: 0.075 },
  { ate: 2902.84, aliq: 0.09 },
  { ate: 4354.27, aliq: 0.12 },
  { ate: 8475.55, aliq: 0.14 },
];

export function calcInss(base: number) {
  let restante = base;
  let anterior = 0;
  let total = 0;
  for (const f of INSS_FAIXAS) {
    if (restante <= 0) break;
    const faixa = Math.min(base, f.ate) - anterior;
    if (faixa > 0) {
      total += faixa * f.aliq;
      restante -= faixa;
    }
    anterior = f.ate;
  }
  return Math.round(total * 100) / 100;
}

const DEDUCAO_DEPENDENTE = 189.59;
// IRRF: tabela progressiva vigente desde jan/2026 (Lei nº 15.191/2025)
const IRRF_FAIXAS = [
  { ate: 2428.8, aliq: 0, ded: 0 },
  { ate: 2826.65, aliq: 0.075, ded: 182.16 },
  { ate: 3751.05, aliq: 0.15, ded: 394.16 },
  { ate: 4664.68, aliq: 0.225, ded: 675.49 },
  { ate: Infinity, aliq: 0.275, ded: 908.73 },
];

/**
 * Redutor mensal do IRRF — Lei 15.270/2025 (Tabela de Redução Mensal RFB,
 * vigente desde jan/2026). Isenção efetiva até R$ 5.000,00 e redução
 * decrescente entre R$ 5.000,01 e R$ 7.350,00.
 */
export function redutorIrrf2026(rendimentoTributavel: number): number {
  if (rendimentoTributavel <= 5000) return 312.89;
  if (rendimentoTributavel <= 7350) {
    return Math.max(0, 978.62 - 0.133145 * rendimentoTributavel);
  }
  return 0;
}

export function calcIrrf(
  baseBruta: number,
  inss: number,
  dependentes: number,
  rendimentoTributavel: number = baseBruta,
) {
  const base = Math.max(0, baseBruta - inss - dependentes * DEDUCAO_DEPENDENTE);
  const faixa = IRRF_FAIXAS.find((f) => base <= f.ate)!;
  const irrfTabela = Math.max(0, base * faixa.aliq - faixa.ded);
  // Lei 15.270/2025: isenção plena até R$ 5.000,00 — o redutor cancela o
  // imposto integralmente, deixando o líquido exatamente em zero. Entre
  // R$ 5.000,01 e R$ 7.350,00 aplica-se a redução decrescente da RFB.
  const redutor =
    rendimentoTributavel <= 5000
      ? irrfTabela
      : redutorIrrf2026(rendimentoTributavel);
  return Math.round(Math.max(0, irrfTabela - redutor) * 100) / 100;
}


export type FuncionarioCC = FonteAdicionais & {
  salario_base: number | string;
  vale_transporte: number | string;
  vale_alimentacao: number | string;
  data_admissao?: string | null;
  data_nascimento?: string | null;
  salario_familia?: number | string;
  valor_extra_salarial?: number | string;
  dependentes?: number | string;
  desconto_vt?: boolean;
};


const r2 = (n: number) => Math.round(n * 100) / 100;

export { FGTS_PCT };

export type FaltaDia = { data: string; tipo: string };

/** Chave da semana (segunda a domingo) a que a data pertence. */
function semanaKey(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0 = segunda
  const segunda = new Date(date.getTime() - dow * 86400000);
  return segunda.toISOString().slice(0, 10);
}

/**
 * Lei 605/49, Art. 6º: a falta injustificada faz perder o repouso semanal
 * remunerado da semana correspondente (segunda a domingo). Cada semana com
 * ao menos uma falta injustificada = 1 dia de DSR perdido.
 */
export function semanasComFaltaInjustificada(faltas: FaltaDia[], mes: string): number {
  const semanas = new Set<string>();
  for (const f of faltas) {
    if (f.tipo !== "injustificada") continue;
    if (!f.data?.startsWith(mes)) continue;
    semanas.add(semanaKey(f.data));
  }
  return semanas.size;
}

export type FeriasMes = {
  /** dias de gozo dentro da competência (1..30) */
  dias_gozados: number;
  /** abono pecuniário — dias vendidos à empresa (máx. 10, CLT Art. 143) */
  dias_vendidos?: number;
};

export type AfastamentoMes = {
  /** ISO date do início do afastamento (pode ser em competência anterior) */
  data_inicio: string;
  tipo?: string;
  data_fim?: string | null;
};

/** Suspensão disciplinar (CLT Art. 474): dias não trabalhados e não pagos. */
export type SuspensaoMes = { data_inicio: string; data_fim: string; motivo?: string };

/** Dias da competência cobertos por suspensão disciplinar. */
export function diasSuspensosNoMes(mes: string, suspensoes: SuspensaoMes[], diasNoMes: number) {
  const dias = new Set<number>();
  for (const s of suspensoes ?? []) {
    const ini = s.data_inicio?.slice(0, 10);
    const fim = (s.data_fim ?? s.data_inicio)?.slice(0, 10);
    if (!ini || !fim) continue;
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${mes}-${String(d).padStart(2, "0")}`;
      if (iso >= ini && iso <= fim) dias.add(d);
    }
  }
  return dias.size;
}

/** Máximo legal de dias de férias que podem ser vendidos (1/3 de 30). */
export const MAX_DIAS_VENDIDOS = 10;


/** Dias do mês em que a empresa ainda paga o salário durante afastamento INSS.
 *  Lei 8.213/91: os 15 primeiros dias de afastamento são de responsabilidade
 *  da empresa; a partir do 16º dia o benefício é pago pelo INSS. */
export function diasPagosNoAfastamento(mes: string, af: AfastamentoMes, diasNoMes: number) {
  const [y, m] = mes.split("-").map(Number);
  const inicioMes = Date.UTC(y, m - 1, 1);
  const [iy, im, id] = af.data_inicio.slice(0, 10).split("-").map(Number);
  const inicio = Date.UTC(iy, im - 1, id);
  // último dia pago pela empresa = 15º dia de afastamento (inclusive)
  const ultimoPago = inicio + 14 * 86400000;

  let diasPagos = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const dia = Date.UTC(y, m - 1, d);
    if (dia < inicio) diasPagos++; // antes do afastamento: trabalhou normalmente
    else if (dia <= ultimoPago) diasPagos++; // dentro dos 15 dias da empresa
  }
  if (inicio > Date.UTC(y, m - 1, diasNoMes)) diasPagos = diasNoMes; // começa depois do mês
  if (inicio < inicioMes && ultimoPago < inicioMes) diasPagos = 0;
  return Math.max(0, Math.min(diasNoMes, diasPagos));
}

/** Avos de 13º acumulados do ano até o mês informado (fração >= 15 dias = mês). */
export function avos13(dataAdmissao: string | null | undefined, mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  let inicioMes = 1;
  if (dataAdmissao) {
    const [ay, am, ad] = dataAdmissao.slice(0, 10).split("-").map(Number);
    if (ay > y) return 0;
    if (ay === y) inicioMes = ad > 16 ? am + 1 : am;
  }
  return Math.max(0, Math.min(12, m - inicioMes + 1));
}

export function calcContracheque(
  f: FuncionarioCC,
  opts: {
    mes: string;
    faltas: FaltaDia[];
    convenio: number;
    salarioMinimoFederal?: number;
    planos?: PlanosConfig;
    ferias?: FeriasMes | null;
    afastamento?: AfastamentoMes | null;
    suspensoes?: SuspensaoMes[] | null;

  },
) {

  const cal = calendarioMes(opts.mes);
  const listaFaltas = (opts.faltas ?? []).filter((x) => x.data?.startsWith(opts.mes));
  const injustificadas = listaFaltas.filter((x) => x.tipo === "injustificada");
  const faltas = Math.min(injustificadas.length, cal.diasUteis);
  const faltasJustificadas = listaFaltas.length - injustificadas.length;

  const salario = Number(f.salario_base) || 0;
  const adic = adicionaisDoCargo(
    adicionaisFonte(f),
    salario,
    opts.salarioMinimoFederal ?? SALARIO_MINIMO_FEDERAL,
  );
  const insalubridade = adic.insalubridade;
  const periculosidade = adic.periculosidade;
  const quebraCaixa = adic.quebraCaixa;
  const adicionais = adic.total;

  const extra = Number(f.valor_extra_salarial) || 0;
  // Salário-família: cota legal por dependente elegível, não varia com faltas.
  const salFamilia = calcSalarioFamilia(salario, Number(f.dependentes) || 0);

  const va = Number(f.vale_alimentacao) || 0;
  const vt = Number(f.vale_transporte) || 0;

  // --- Faltas: dia + DSR (semana cheia perdida, Lei 605/49 Art. 6º) ---
  const baseDia = (salario + adicionais) / 30;
  const descFaltas = r2(baseDia * faltas);
  const dsrDias = semanasComFaltaInjustificada(injustificadas, opts.mes);
  const descDsr = r2(baseDia * dsrDias);

  // --- Redução proporcional em verbas extras e benefícios ---
  const fatorProporcional = cal.diasUteis > 0 ? faltas / cal.diasUteis : 0;
  const descExtra = r2(extra * fatorProporcional);
  const descVa = r2(va * fatorProporcional);
  // Vale-transporte é fornecido em valor fixo (passagens do mês), sem redução por faltas.
  const descVtBeneficio = 0;

  // --- Férias no mês (CLT Art. 129 e 143) ---
  const emFerias = !!opts.ferias && Number(opts.ferias.dias_gozados) > 0;
  const diasFerias = emFerias ? Math.min(30, Number(opts.ferias!.dias_gozados) || 0) : 0;
  const diasVendidos = emFerias
    ? Math.max(0, Math.min(MAX_DIAS_VENDIDOS, 30 - diasFerias, Number(opts.ferias!.dias_vendidos) || 0))
    : 0;
  // Salário integral do período já está em proventos; aqui entra o 1/3 constitucional.
  const feriasBase = r2(baseDia * diasFerias);
  const feriasTerco = r2(feriasBase / 3);
  // Abono pecuniário (dias vendidos) + 1/3 — isento de INSS e IRRF.
  const abonoFerias = r2(baseDia * diasVendidos);
  const abonoTerco = r2(abonoFerias / 3);
  const abonoTotal = r2(abonoFerias + abonoTerco);

  // --- Afastamento pelo INSS (Lei 8.213/91, Art. 60 §3º) ---
  const afastado = !!opts.afastamento?.data_inicio;
  const diasPagosEmpresa = afastado
    ? diasPagosNoAfastamento(opts.mes, opts.afastamento!, cal.diasNoMes)
    : cal.diasNoMes;
  const diasSemPagamento = afastado ? Math.max(0, cal.diasNoMes - diasPagosEmpresa) : 0;
  const descAfastamento = afastado ? r2((baseDia * 30 * diasSemPagamento) / cal.diasNoMes) : 0;

  // --- Suspensão disciplinar (CLT Art. 474): dias não trabalhados e não pagos ---
  const diasSuspensos = diasSuspensosNoMes(opts.mes, opts.suspensoes ?? [], cal.diasNoMes);
  const descSuspensao = r2(baseDia * Math.min(diasSuspensos, 30));


  // --- 13º salário parcelado (novembro = 1ª parcela, dezembro = 2ª) ---
  const mesNum = Number(opts.mes.split("-")[1]);
  const avosDez = avos13(f.data_admissao, `${opts.mes.split("-")[0]}-12`);
  const avosNov = avos13(f.data_admissao, `${opts.mes.split("-")[0]}-11`);
  const remuneracao13 = salario + adicionais;
  const decimoPrimeiraParcela = mesNum >= 11 ? r2(((remuneracao13 / 12) * avosNov) / 2) : 0;
  const decimoTotalAno = mesNum === 12 ? r2((remuneracao13 / 12) * avosDez) : 0;
  const decimoSegundaParcela = mesNum === 12 ? r2(decimoTotalAno - decimoPrimeiraParcela) : 0;
  // 1ª parcela (novembro) é isenta; em dezembro INSS/IRRF incidem sobre o total.
  const decimoNoMes = mesNum === 11 ? decimoPrimeiraParcela : mesNum === 12 ? decimoSegundaParcela : 0;
  const inss13 = mesNum === 12 && decimoTotalAno > 0 ? calcInss(decimoTotalAno) : 0;
  const irrf13 =
    mesNum === 12 && decimoTotalAno > 0
      ? calcIrrf(decimoTotalAno, inss13, Number(f.dependentes) || 0)
      : 0;

  const proventos = r2(
    salario + adicionais + extra + salFamilia + feriasTerco + abonoTotal + decimoNoMes,
  );
  const vaLiquido = r2(va - descVa);
  const vtLiquido = r2(vt - descVtBeneficio);

  // --- Descontos legais ---
  const baseInss = Math.max(
    0,
    r2(
      salario + adicionais + extra + feriasTerco -
        descFaltas - descDsr - descExtra - descAfastamento - descSuspensao,
    ),
  );
  const inssMes = calcInss(baseInss);
  const inss = r2(inssMes + inss13);

  // --- FGTS do mês (Lei 8.036/90, Art. 15): 8% sobre a remuneração paga no mês.
  // Custo da empresa — não entra em totalDescontos nem no líquido.
  // Durante o afastamento por doença o FGTS continua devido sobre o salário.
  const baseFgts = Math.max(
    0,
    r2(
      salario + adicionais + extra + feriasTerco + decimoNoMes -
        descFaltas - descDsr - descSuspensao,
    ),
  );
  const fgts = r2(baseFgts * FGTS_PCT);
  const irrf = r2(calcIrrf(baseInss, inssMes, Number(f.dependentes) || 0) + irrf13);
  const descontoVt = f.desconto_vt ? r2(Math.min(salario * 0.06, vtLiquido)) : 0;
  // Planos de saúde e odontológico: benefício custeado pela empresa — não descontado.
  const planosCalc = planosDoFuncionario(
    f,
    opts.planos ?? PLANOS_CONFIG_ZERO,
    referenciaCompetencia(opts.mes),
  );
  const planoSaude = planosCalc.planoSaude;
  const planoOdonto = planosCalc.planoOdonto;
  const convenio = Math.max(0, Number(opts.convenio) || 0);

  const totalDescontos = r2(
    descFaltas + descDsr + descExtra + descAfastamento + descSuspensao +
      inss + irrf + descontoVt + convenio,
  );

  const liquido = r2(proventos - totalDescontos);

  return {
    calendario: cal,
    faltas,
    faltasJustificadas,
    dsrDias,
    salario,
    insalubridade,
    periculosidade,
    quebraCaixa,
    adicionais,
    extra,
    salFamilia,
    emFerias,
    diasFerias,
    diasVendidos,
    feriasBase,
    feriasTerco,
    abonoFerias,
    abonoTerco,
    abonoTotal,
    afastado,
    tipoAfastamento: opts.afastamento?.tipo ?? null,
    diasPagosEmpresa,
    diasSemPagamento,
    descAfastamento,
    decimoPrimeiraParcela,
    decimoSegundaParcela,
    decimoTotalAno,
    decimoNoMes,
    inss13,
    irrf13,
    proventos,
    descFaltas,
    descDsr,
    descExtra,
    descVa,
    descVtBeneficio,
    va,
    vt,
    vaLiquido,
    vtLiquido,
    baseInss,
    inss,
    baseFgts,
    fgts,
    irrf,
    descontoVt,
    planoSaude,
    planoOdonto,
    planosCalc,
    convenio,
    totalDescontos,
    liquido,
  };
}

export type Contracheque = ReturnType<typeof calcContracheque>;

/** Situação do funcionário derivada do contracheque da competência aberta. */
export function situacaoDerivada(o: { ferias?: unknown; afastamento?: unknown }) {
  if (o.afastamento) return "Afastado (INSS)";
  if (o.ferias) return "Férias";
  return "Ativo";
}

