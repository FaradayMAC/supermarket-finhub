// ============================================================================
// Competência de folha (mês/ano) — regra geral do sistema
// ----------------------------------------------------------------------------
// Funcionários = cadastro (estado atual, sem histórico).
// Contracheque = folha mensal por competência:
//   - aberta  → recalculada ao vivo a partir do cadastro + faltas do mês;
//   - fechada → histórico imutável gravado em folha_pagamento.
// ============================================================================

export type StatusCompetencia = "aberta" | "fechada";

export const mesAtualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** 'YYYY-MM' → 'YYYY-MM-01' (competência gravada como date no banco) */
export const competenciaDate = (mes: string) => `${mes}-01`;

/** Só faz sentido fechar competências já encerradas (meses passados). */
export function podeFechar(mes: string) {
  return mes < mesAtualISO();
}

export function isMesFuturo(mes: string) {
  return mes > mesAtualISO();
}

/**
 * Funcionário entra na folha da competência?
 * Desligado deixa de entrar a partir do mês seguinte ao desligamento;
 * admitido depois do mês também não entra.
 */
export function entraNaCompetencia(
  f: { ativo?: boolean; data_admissao?: string | null; data_desligamento?: string | null },
  mes: string,
) {
  const adm = f.data_admissao?.slice(0, 7);
  if (adm && adm > mes) return false;
  const desl = f.data_desligamento?.slice(0, 7);
  if (desl) return mes <= desl;
  return f.ativo !== false;
}

export function fmtDataHora(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
