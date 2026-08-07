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

// --- Tabelas oficiais (INSS / IRRF) ---------------------------------------
const INSS_FAIXAS = [
  { ate: 1518.0, aliq: 0.075 },
  { ate: 2793.88, aliq: 0.09 },
  { ate: 4190.83, aliq: 0.12 },
  { ate: 8157.41, aliq: 0.14 },
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
const IRRF_FAIXAS = [
  { ate: 2259.2, aliq: 0, ded: 0 },
  { ate: 2826.65, aliq: 0.075, ded: 169.44 },
  { ate: 3751.05, aliq: 0.15, ded: 381.44 },
  { ate: 4664.68, aliq: 0.225, ded: 662.77 },
  { ate: Infinity, aliq: 0.275, ded: 896.0 },
];

export function calcIrrf(baseBruta: number, inss: number, dependentes: number) {
  const base = Math.max(0, baseBruta - inss - dependentes * DEDUCAO_DEPENDENTE);
  const faixa = IRRF_FAIXAS.find((f) => base <= f.ate)!;
  return Math.round(Math.max(0, base * faixa.aliq - faixa.ded) * 100) / 100;
}

export type FuncionarioCC = {
  salario_base: number | string;
  vale_transporte: number | string;
  vale_alimentacao: number | string;
  plano_saude: number | string;
  plano_odontologico?: number | string;
  salario_familia?: number | string;
  valor_extra_salarial?: number | string;
  insalubridade_pct?: number | string;
  periculosidade_pct?: number | string;
  quebra_caixa_pct?: number | string;
  dependentes?: number | string;
  desconto_vt?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcContracheque(f: FuncionarioCC, opts: { mes: string; faltas: number; convenio: number }) {
  const cal = calendarioMes(opts.mes);
  const faltas = Math.max(0, Math.min(opts.faltas || 0, cal.diasUteis));

  const salario = Number(f.salario_base) || 0;
  const insalPct = Number(f.insalubridade_pct) || 0;
  const pericPct = Number(f.periculosidade_pct) || 0;
  const qcPct = Number(f.quebra_caixa_pct) || 0;
  const insalubridade = r2((salario * insalPct) / 100);
  const periculosidade = r2((salario * pericPct) / 100);
  const quebraCaixa = r2((salario * qcPct) / 100);
  const adicionais = insalubridade + periculosidade + quebraCaixa;

  const extra = Number(f.valor_extra_salarial) || 0;
  const salFamilia = Number(f.salario_familia) || 0;
  const va = Number(f.vale_alimentacao) || 0;
  const vt = Number(f.vale_transporte) || 0;

  // --- Faltas: dia + DSR ---
  const baseDia = (salario + adicionais) / 30;
  const descFaltas = r2(baseDia * faltas);
  const dsrDias = cal.diasUteis > 0 ? (faltas / cal.diasUteis) * cal.diasRepouso : 0;
  const descDsr = r2(baseDia * dsrDias);

  // --- Redução proporcional em verbas extras e benefícios ---
  const fatorProporcional = cal.diasUteis > 0 ? faltas / cal.diasUteis : 0;
  const descExtra = r2(extra * fatorProporcional);
  const descVa = r2(va * fatorProporcional);
  const descVtBeneficio = r2(vt * fatorProporcional);

  const proventos = r2(salario + adicionais + extra + salFamilia);
  const vaLiquido = r2(va - descVa);
  const vtLiquido = r2(vt - descVtBeneficio);

  // --- Descontos legais ---
  const baseInss = Math.max(0, r2(salario + adicionais + extra - descFaltas - descDsr - descExtra));
  const inss = calcInss(baseInss);
  const irrf = calcIrrf(baseInss, inss, Number(f.dependentes) || 0);
  const descontoVt = f.desconto_vt ? r2(Math.min(salario * 0.06, vtLiquido)) : 0;
  const planoSaude = Number(f.plano_saude) || 0;
  const planoOdonto = Number(f.plano_odontologico) || 0;
  const convenio = Math.max(0, Number(opts.convenio) || 0);

  const totalDescontos = r2(
    descFaltas + descDsr + descExtra + inss + irrf + descontoVt + planoSaude + planoOdonto + convenio,
  );
  const liquido = r2(proventos - totalDescontos);

  return {
    calendario: cal,
    faltas,
    dsrDias: Math.round(dsrDias * 100) / 100,
    salario,
    insalubridade,
    periculosidade,
    quebraCaixa,
    adicionais,
    extra,
    salFamilia,
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
    irrf,
    descontoVt,
    planoSaude,
    planoOdonto,
    convenio,
    totalDescontos,
    liquido,
  };
}

export type Contracheque = ReturnType<typeof calcContracheque>;
