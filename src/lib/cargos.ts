// Adicionais legais por cargo/função — base legal explícita.
//
// | Adicional        | %   | Base de cálculo          | Fundamento                          |
// |------------------|-----|--------------------------|-------------------------------------|
// | Quebra de caixa  | 22% | Salário mínimo federal   | CCT Fecomércio-ES, Cláusula 4ª      |
// | Insalubridade    | 10% | Salário mínimo federal   | CCT Fecomércio-ES, Cláusula 26ª     |
// | Insalubridade    | 20% | Salário mínimo federal   | NR-15, Anexo 9 (câmara fria)        |
// | Periculosidade   | 30% | Salário base do func.    | CLT Art. 193 §4º (Lei 12.997/2014)  |
//
// O piso salarial do comerciário-ES (CCT Cláusula 1ª §2º) NÃO entra em nenhum
// desses cálculos — serve apenas de piso mínimo de contratação por função.

/** Salário mínimo federal 2026 (Decreto 12.797/2025) — fallback do banco. */
export const SALARIO_MINIMO_FEDERAL = 1621;
/** Piso salarial do comerciário-ES (CCT Cláusula 1ª §2º) — apenas referência. */
export const PISO_COMERCIARIO_ES = 1650;

/** Fixo por convenção coletiva — não é editável no sistema. */
export const QUEBRA_CAIXA_PCT = 22;
/** Caso padrão (motoboy); permanece editável por cargo. */
export const PERICULOSIDADE_PCT_PADRAO = 30;

export type MotivoInsalubridade = "nenhum" | "asg_limpeza_terceirizada" | "frio_camara_fria";

export const MOTIVOS_INSALUBRIDADE: Record<
  MotivoInsalubridade,
  { grau: number; label: string; fundamento: string }
> = {
  nenhum: { grau: 0, label: "Sem insalubridade", fundamento: "" },
  asg_limpeza_terceirizada: {
    grau: 10,
    label: "ASG / limpeza terceirizada — grau mínimo (10%)",
    fundamento: "CCT Fecomércio-ES, Cláusula 26ª",
  },
  frio_camara_fria: {
    grau: 20,
    label: "Açougue, padaria, salgados — câmara fria — grau médio (20%)",
    fundamento: "NR-15, Anexo 9",
  },
};

export function grauInsalubridade(motivo: MotivoInsalubridade | null | undefined): number {
  return MOTIVOS_INSALUBRIDADE[(motivo ?? "nenhum") as MotivoInsalubridade]?.grau ?? 0;
}

export type Cargo = {
  id: string;
  nome: string;
  salario_base: number;
  tem_periculosidade: boolean;
  periculosidade_pct: number;
  tem_quebra_caixa: boolean;
  motivo_insalubridade: MotivoInsalubridade;
  ativo: boolean;
};

export type CargoAdicionais = {
  tem_periculosidade?: boolean | null;
  periculosidade_pct?: number | string | null;
  tem_quebra_caixa?: boolean | null;
  motivo_insalubridade?: MotivoInsalubridade | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valores em reais dos adicionais legais para um dado salário base. */
export function adicionaisDoCargo(
  c: CargoAdicionais,
  salarioBase: number,
  salarioMinimoFederal: number = SALARIO_MINIMO_FEDERAL,
) {
  const sm = Number(salarioMinimoFederal) || 0;
  const base = Number(salarioBase) || 0;
  const pericPct = Number(c.periculosidade_pct ?? PERICULOSIDADE_PCT_PADRAO) || 0;
  const grau = grauInsalubridade(c.motivo_insalubridade);

  const periculosidade = c.tem_periculosidade ? r2((base * pericPct) / 100) : 0;
  const quebraCaixa = c.tem_quebra_caixa ? r2((sm * QUEBRA_CAIXA_PCT) / 100) : 0;
  const insalubridade = grau > 0 ? r2((sm * grau) / 100) : 0;

  return {
    periculosidade,
    pericPct,
    quebraCaixa,
    insalubridade,
    grauInsalubridade: grau,
    total: r2(periculosidade + quebraCaixa + insalubridade),
  };
}
