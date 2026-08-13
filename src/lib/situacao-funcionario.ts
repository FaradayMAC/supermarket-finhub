// ============================================================================
// Situação do funcionário — fonte única da verdade
// ----------------------------------------------------------------------------
// Ordem de prioridade (da mais específica para a mais genérica):
//   Desligado → Suspenso → Afastado (INSS) → Grávida / Estabilidade (gestante)
//   → Férias → Experiência → Ativo
// ============================================================================

export type SituacaoFuncionario =
  | "Ativo"
  | "Desligado"
  | "Férias"
  | "Afastado (INSS)"
  | "Experiência"
  | "Suspenso"
  | "Grávida"
  | "Estabilidade (gestante)"
  | "Afastado (Acidente de Trabalho)"
  | "Estabilidade (acidente de trabalho)";

/** Atestado por acidente de trabalho (Lei 8.213/91). */
export type AtestadoAcidente = {
  id?: string;
  funcionario_id?: string;
  data_inicio: string;
  dias_atestado: number;
  afastado_inss?: boolean;
  numero_cat?: string | null;
  data_retorno?: string | null;
};

/** Teto de dias de atestado pagos pela empresa (Lei 8.213/91, Art. 60, §3º).
 *  Vale esteja o funcionário formalmente afastado pelo INSS ou não. */
export function diasPagosEmpresa(diasAtestado: number): number {
  return Math.max(0, Math.min(Number(diasAtestado) || 0, 15));
}

/** Estabilidade acidentária: 12 meses contados do retorno (Lei 8.213/91, Art. 118). */
export const MESES_ESTABILIDADE_ACIDENTE = 12;

export function fimEstabilidadeAcidente(dataRetorno: string): string {
  const [y, m, d] = dataRetorno.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Situação decorrente de acidente de trabalho:
 *  - sem data de retorno → "Afastado (Acidente de Trabalho)";
 *  - com retorno dentro dos 12 meses → "Estabilidade (acidente de trabalho)".
 */
export function situacaoAcidente(
  atestados: AtestadoAcidente[] | null | undefined,
  hoje: string = hojeISO(),
): { situacao: SituacaoFuncionario; fimEstabilidade: string | null } | null {
  const dia = hoje.slice(0, 10);
  const lista = atestados ?? [];
  if (lista.some((a) => !a.data_retorno && a.data_inicio?.slice(0, 10) <= dia))
    return { situacao: "Afastado (Acidente de Trabalho)", fimEstabilidade: null };
  let melhor: string | null = null;
  for (const a of lista) {
    if (!a.data_retorno) continue;
    const fim = fimEstabilidadeAcidente(a.data_retorno);
    if (fim && dia <= fim && (!melhor || fim > melhor)) melhor = fim;
  }
  if (melhor) return { situacao: "Estabilidade (acidente de trabalho)", fimEstabilidade: melhor };
  return null;
}


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
  data_confirmacao_gravidez?: string | null;
  data_retorno_licenca_maternidade?: string | null;
};

/** Dias de estabilidade praticados pela empresa a partir do retorno da licença. */
export const DIAS_ESTABILIDADE_GESTANTE = 90;

export function addDiasISO(dataISO: string, dias: number): string {
  const [y, m, d] = dataISO.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d) + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Regra operacional da empresa: 90 dias corridos de estabilidade contados do
 * retorno da licença-maternidade. Enquanto não há retorno registrado, a
 * funcionária segue como "Grávida" (gestação ou licença em curso).
 * Referência legal mínima: ADCT Art. 10, II, "b" (5 meses após o parto).
 */
export function estabilidadeGestante(
  dataConfirmacao: string | null | undefined,
  dataRetorno: string | null | undefined,
  hoje: string = hojeISO(),
): { situacao: SituacaoFuncionario; fimEstabilidade: string | null } | null {
  if (!dataConfirmacao) return null;
  if (!dataRetorno) return { situacao: "Grávida", fimEstabilidade: null };
  const fim = addDiasISO(dataRetorno, DIAS_ESTABILIDADE_GESTANTE);
  if (hoje.slice(0, 10) <= fim)
    return { situacao: "Estabilidade (gestante)", fimEstabilidade: fim };
  return null;
}

export function situacaoAtual(
  f: FuncionarioSituacao,
  hoje: string,
  situacaoMes: string | null,
  suspensaoAtiva: Suspensao | null,
  atestadosAcidente?: AtestadoAcidente[] | null,
): SituacaoFuncionario {
  if (f.data_desligamento) return "Desligado";
  if (suspensaoAtiva) return "Suspenso";
  const acid = situacaoAcidente(atestadosAcidente, hoje);
  if (acid?.situacao === "Afastado (Acidente de Trabalho)") return acid.situacao;
  if (situacaoMes === "Afastado (INSS)") return "Afastado (INSS)";
  if (acid) return acid.situacao;
  const gest = estabilidadeGestante(
    f.data_confirmacao_gravidez,
    f.data_retorno_licenca_maternidade,
    hoje,
  );
  if (gest) return gest.situacao;
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
  Grávida: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "Estabilidade (gestante)": "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
  "Afastado (Acidente de Trabalho)": "bg-red-500/15 text-red-700 dark:text-red-400",
  "Estabilidade (acidente de trabalho)": "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  Desligado: "bg-muted text-muted-foreground",

};
