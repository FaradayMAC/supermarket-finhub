// ============================================================================
// Planos de saúde e odontológico — valores globais da empresa
// ----------------------------------------------------------------------------
// Os valores não são digitados por funcionário: vêm de três configurações
// globais (tela principal do módulo Cargos) e são aplicados automaticamente
// segundo duas regras:
//   1. Carência: só a partir de 3 meses completos de admissão.
//   2. Faixa etária (só plano de saúde): 18–43 anos = faixa 1; 44+ = faixa 2.
// ============================================================================

export const CHAVE_PLANO_ODONTO = "valor_plano_odontologico";
export const CHAVE_PLANO_SAUDE_F1 = "valor_plano_saude_faixa1";
export const CHAVE_PLANO_SAUDE_F2 = "valor_plano_saude_faixa2";

export const CARENCIA_PLANOS_MESES = 3;

export type PlanosConfig = {
  odontologico: number;
  saudeFaixa1: number;
  saudeFaixa2: number;
};

export const PLANOS_CONFIG_ZERO: PlanosConfig = {
  odontologico: 0,
  saudeFaixa1: 0,
  saudeFaixa2: 0,
};

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** Meses completos entre duas datas. */
export function diferencaEmMeses(inicio: Date, fim: Date): number {
  let meses =
    (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    (fim.getUTCMonth() - inicio.getUTCMonth());
  if (fim.getUTCDate() < inicio.getUTCDate()) meses -= 1;
  return meses;
}

/** Data em que a carência de 3 meses se completa. */
export function dataFimCarencia(dataAdmissao: string | null | undefined): Date | null {
  const adm = parseDate(dataAdmissao);
  if (!adm) return null;
  return new Date(
    Date.UTC(adm.getUTCFullYear(), adm.getUTCMonth() + CARENCIA_PLANOS_MESES, adm.getUTCDate()),
  );
}

export function temDireitoAosPlanos(
  dataAdmissao: string | null | undefined,
  dataReferencia: Date,
): boolean {
  const adm = parseDate(dataAdmissao);
  if (!adm) return false;
  return diferencaEmMeses(adm, dataReferencia) >= CARENCIA_PLANOS_MESES;
}

/** Idade completa na data de referência. */
export function idadeNaCompetencia(
  dataNascimento: string | null | undefined,
  dataReferencia: Date,
): number | null {
  const nasc = parseDate(dataNascimento);
  if (!nasc) return null;
  return Math.floor(diferencaEmMeses(nasc, dataReferencia) / 12);
}

export function valorPlanoSaude(config: PlanosConfig, idade: number | null): number {
  if (idade !== null && idade >= 44) return Number(config.saudeFaixa2) || 0;
  return Number(config.saudeFaixa1) || 0;
}

/** Último dia do mês de competência (YYYY-MM) — data de referência da folha. */
export function referenciaCompetencia(mes: string): Date {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y || new Date().getFullYear(), m || 1, 0));
}

export function hojeUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export type FonteFuncionarioPlanos = {
  data_admissao?: string | null;
  data_nascimento?: string | null;
};

export function planosDoFuncionario(
  f: FonteFuncionarioPlanos,
  config: PlanosConfig = PLANOS_CONFIG_ZERO,
  dataReferencia: Date = hojeUTC(),
) {
  const elegivel = temDireitoAosPlanos(f.data_admissao, dataReferencia);
  const idade = idadeNaCompetencia(f.data_nascimento, dataReferencia);
  const fim = dataFimCarencia(f.data_admissao);
  const diasParaCarencia =
    !elegivel && fim
      ? Math.max(0, Math.ceil((fim.getTime() - dataReferencia.getTime()) / 86400000))
      : 0;

  if (!elegivel) {
    return { planoSaude: 0, planoOdonto: 0, elegivel, idade, diasParaCarencia };
  }
  return {
    planoSaude: valorPlanoSaude(config, idade),
    planoOdonto: Number(config.odontologico) || 0,
    elegivel,
    idade,
    diasParaCarencia: 0,
  };
}
