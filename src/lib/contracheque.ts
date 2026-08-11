import { adicionaisDoCargo, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";
import { adicionaisFonte, type FonteAdicionais } from "@/lib/custo-funcionario";
import { FGTS_PCT } from "@/lib/encargos";
import { calcSalarioFamilia } from "@/lib/salario-familia";


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
  const redutor = redutorIrrf2026(rendimentoTributavel);
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

export function calcContracheque(
  f: FuncionarioCC,
  opts: {
    mes: string;
    faltas: FaltaDia[];
    convenio: number;
    salarioMinimoFederal?: number;
    planos?: PlanosConfig;
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
  const descVtBeneficio = r2(vt * fatorProporcional);


  const proventos = r2(salario + adicionais + extra + salFamilia);
  const vaLiquido = r2(va - descVa);
  const vtLiquido = r2(vt - descVtBeneficio);

  // --- Descontos legais ---
  const baseInss = Math.max(0, r2(salario + adicionais + extra - descFaltas - descDsr - descExtra));
  const inss = calcInss(baseInss);

  // --- FGTS do mês (Lei 8.036/90, Art. 15): 8% sobre a remuneração paga no mês.
  // Custo da empresa — não entra em totalDescontos nem no líquido.
  const baseFgts = Math.max(0, r2(salario + adicionais + extra - descFaltas - descDsr));
  const fgts = r2(baseFgts * FGTS_PCT);
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
    faltasJustificadas,
    dsrDias,
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
    baseFgts,
    fgts,
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
