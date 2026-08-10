// Cargos: base salarial e adicionais legais.
// - Periculosidade: 12% sobre o salário base do funcionário/cargo.
// - Insalubridade: 10% (grau médio) ou 20% (grau máximo) sobre o salário mínimo.
// - Quebra de caixa: 22% sobre o salário mínimo.
export const SALARIO_MINIMO = 1518;

export const PERICULOSIDADE_PCT = 12;
export const QUEBRA_CAIXA_PCT = 22;

export type Cargo = {
  id: string;
  nome: string;
  descricao: string | null;
  salario_base: number;
  tem_periculosidade: boolean;
  periculosidade_pct: number;
  tem_quebra_caixa: boolean;
  quebra_caixa_pct: number;
  insalubridade_grau: number;
  ativo: boolean;
};

export type CargoAdicionais = Pick<
  Cargo,
  "tem_periculosidade" | "tem_quebra_caixa" | "insalubridade_grau"
> &
  Partial<Pick<Cargo, "periculosidade_pct" | "quebra_caixa_pct">>;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valores em reais dos adicionais de um cargo para um dado salário base. */
export function adicionaisDoCargo(
  c: CargoAdicionais,
  salarioBase: number,
  salarioMinimo: number = SALARIO_MINIMO,
) {
  const pericPct = Number(c.periculosidade_pct ?? PERICULOSIDADE_PCT) || 0;
  const qcPct = Number(c.quebra_caixa_pct ?? QUEBRA_CAIXA_PCT) || 0;
  const grau = Number(c.insalubridade_grau) || 0;
  const sm = Number(salarioMinimo) || 0;

  const periculosidade = c.tem_periculosidade ? r2((salarioBase * pericPct) / 100) : 0;
  const quebraCaixa = c.tem_quebra_caixa ? r2((sm * qcPct) / 100) : 0;
  const insalubridade = grau > 0 ? r2((sm * grau) / 100) : 0;

  return {
    periculosidade,
    quebraCaixa,
    insalubridade,
    total: r2(periculosidade + quebraCaixa + insalubridade),
  };
}

/**
 * Converte os adicionais do cargo (em R$) para os percentuais sobre o salário
 * base usados no cadastro do funcionário e no contracheque.
 */
export function adicionaisPct(
  c: CargoAdicionais,
  salarioBase: number,
  salarioMinimo: number = SALARIO_MINIMO,
) {
  const a = adicionaisDoCargo(c, salarioBase, salarioMinimo);
  const pct = (v: number) => (salarioBase > 0 ? Math.round((v / salarioBase) * 10000) / 100 : 0);
  return {
    periculosidade_pct: pct(a.periculosidade),
    quebra_caixa_pct: pct(a.quebraCaixa),
    insalubridade_pct: pct(a.insalubridade),
    valores: a,
  };
}

