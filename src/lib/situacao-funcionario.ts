// ============================================================================
// Situação do funcionário — fonte única da verdade
// ----------------------------------------------------------------------------
// Ordem de prioridade (da mais específica para a mais genérica):
//   Desligado → Suspenso → Afastado (INSS) → Férias → Experiência → Ativo
// ============================================================================

export type SituacaoFuncionario =
  | "Ativo"
  | "Desligado"
  | "Férias"
  | "Afastado (INSS)"
  | "Experiência"
  | "Suspenso";

export type Suspensao = {
  id?: string;
  funcionario_id?: string;
  data_inicio: string;
  data_fim: string;
  motivo?: string;
};

/** Teto legal do contrato de experiência (CLT Art. 445, parágrafo único). */
export const DIAS_EXPERIENCIA_PADRAO = 90;

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/** data_admissao + 90 dias (ISO 'YYYY-MM-DD'); vazio quando não há admissão. */
export function fimExperienciaPadrao(dataAdmissao?: string | null): string {
  if (!dataAdmissao) return "";
  const [y, m, d] = dataAdmissao.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d) + DIAS_EXPERIENCIA_PADRAO * 86400000);
  return dt.toISOString().slice(0, 10);
}

/** Suspensão vigente na data informada (ISO), ou null. */
export function suspensaoVigente(
  suspensoes: Suspensao[] | undefined | null,
  hoje: string = hojeISO(),
): Suspensao | null {
  const dia = hoje.slice(0, 10);
  return (
    (suspensoes ?? []).find(
      (s) => s.data_inicio?.slice(0, 10) <= dia && dia <= s.data_fim?.slice(0, 10),
    ) ?? null
  );
}

export type FuncionarioSituacao = {
  data_desligamento?: string | null;
  data_fim_experiencia?: string | null;
};

export function situacaoAtual(
  f: FuncionarioSituacao,
  hoje: string,
  situacaoMes: string | null,
  suspensaoAtiva: Suspensao | null,
): SituacaoFuncionario {
  if (f.data_desligamento) return "Desligado";
  if (suspensaoAtiva) return "Suspenso";
  if (situacaoMes === "Afastado (INSS)") return "Afastado (INSS)";
  if (situacaoMes === "Férias") return "Férias";
  const fim = f.data_fim_experiencia?.slice(0, 10);
  if (fim && hoje.slice(0, 10) <= fim) return "Experiência";
  return "Ativo";
}

/** Classes de cor do selo de cada situação (tokens do design system). */
export const CORES_SITUACAO: Record<SituacaoFuncionario, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Experiência: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  Férias: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Afastado (INSS)": "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Suspenso: "bg-orange-600/20 text-orange-800 dark:text-orange-300",
  Desligado: "bg-muted text-muted-foreground",
};
