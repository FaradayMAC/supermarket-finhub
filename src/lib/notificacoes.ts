// ============================================================================
// Central de Notificações — cálculo ao vivo a partir das datas do cadastro
// Sem cron/job: tudo derivado de data_admissao e data_fim_experiencia.
// ============================================================================

export type TipoNotificacao =
  | "plano_saude"
  | "fim_1o_contrato_experiencia"
  | "fim_2o_contrato_experiencia";

export type FuncionarioNotificavel = {
  id: string;
  nome: string;
  data_admissao?: string | null;
  data_fim_experiencia?: string | null;
  data_desligamento?: string | null;
};

export type Notificacao = {
  id: string; // `${funcionario_id}|${tipo}|${data_evento}`
  tipo: TipoNotificacao;
  funcionario_id: string;
  funcionario_nome: string;
  data_evento: string; // ISO yyyy-mm-dd — data do gatilho
  mensagem: string;
};

export const DIAS_ANTECEDENCIA = 5;
export const DIAS_1O_CONTRATO = 45;

/** Converte "yyyy-mm-dd" (ou Date) em Date local à meia-noite. */
export function diaLocal(v: string | Date): Date {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const [a, m, d] = v.slice(0, 10).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDias(d: Date, n: number): Date {
  const r = diaLocal(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMeses(d: Date, n: number): Date {
  const base = diaLocal(d);
  const r = new Date(base.getFullYear(), base.getMonth() + n, base.getDate());
  // se o mês de destino não tem o dia (ex.: 31), cai no último dia do mês
  if (r.getMonth() !== (base.getMonth() + n + 12000) % 12) r.setDate(0);
  return r;
}

export function mesmoDia(a: Date | string, b: Date | string): boolean {
  return toISO(diaLocal(a)) === toISO(diaLocal(b));
}

/** Dias inteiros de `hoje` até `alvo` (positivo = no futuro). */
export function diasEntre(hoje: Date | string, alvo: Date | string): number {
  const ms = diaLocal(alvo).getTime() - diaLocal(hoje).getTime();
  return Math.round(ms / 86400000);
}

export const LABEL_TIPO: Record<TipoNotificacao, string> = {
  plano_saude: "Plano de saúde/odontológico",
  fim_1o_contrato_experiencia: "1º contrato de experiência",
  fim_2o_contrato_experiencia: "Contrato de experiência (90 dias)",
};

export function notificacoesDoDia(
  funcs: FuncionarioNotificavel[],
  hoje: Date = new Date(),
): Notificacao[] {
  const lista: Notificacao[] = [];
  const push = (
    f: FuncionarioNotificavel,
    tipo: TipoNotificacao,
    data: Date,
    mensagem: string,
  ) => {
    const data_evento = toISO(data);
    lista.push({
      id: `${f.id}|${tipo}|${data_evento}`,
      tipo,
      funcionario_id: f.id,
      funcionario_nome: f.nome,
      data_evento,
      mensagem,
    });
  };

  for (const f of funcs) {
    if (f.data_desligamento) continue;

    if (f.data_admissao) {
      // 1. Completou 3 meses — dar entrada no plano de saúde/odontológico
      const tresMeses = addMeses(diaLocal(f.data_admissao), 3);
      if (mesmoDia(hoje, tresMeses)) {
        push(
          f,
          "plano_saude",
          tresMeses,
          `${f.nome} completou 3 meses hoje — dar entrada no plano odontológico e de saúde junto à operadora.`,
        );
      }

      // 2. Fim do 1º contrato de experiência (45 dias) — 5 dias antes
      const fim1 = addDias(diaLocal(f.data_admissao), DIAS_1O_CONTRATO);
      if (diasEntre(hoje, fim1) === DIAS_ANTECEDENCIA) {
        push(
          f,
          "fim_1o_contrato_experiencia",
          fim1,
          `${f.nome} — o 1º contrato de experiência (45 dias) termina em 5 dias. Decidir sobre a renovação.`,
        );
      }
    }

    // 3. Fim do contrato de experiência (90 dias) — 5 dias antes
    if (f.data_fim_experiencia) {
      const fim2 = diaLocal(f.data_fim_experiencia);
      if (diasEntre(hoje, fim2) === DIAS_ANTECEDENCIA) {
        push(
          f,
          "fim_2o_contrato_experiencia",
          fim2,
          `${f.nome} — o contrato de experiência (90 dias) termina em 5 dias. Decidir sobre a efetivação.`,
        );
      }
    }
  }

  return lista;
}

/** Remove as notificações já marcadas como lidas. */
export function filtrarNaoLidas(
  todas: Notificacao[],
  lidas: { funcionario_id: string; tipo: string; data_evento: string }[],
): Notificacao[] {
  const set = new Set(
    lidas.map((l) => `${l.funcionario_id}|${l.tipo}|${l.data_evento.slice(0, 10)}`),
  );
  return todas.filter((n) => !set.has(n.id));
}
