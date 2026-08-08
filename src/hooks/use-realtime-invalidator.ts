import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tabelas-fonte cujas mudanças disparam recálculo automático em todas as telas
const TABLES = [
  "despesas",
  "impostos",
  "folha_pagamento",
  "movimentacoes_financeiras",
  "vendas_diarias",
  "funcionarios",
  "metas",
  "lojas",
  "categorias_despesa",
] as const;


/**
 * Motor de recálculo automático baseado em eventos.
 * Escuta INSERT/UPDATE/DELETE em todas as tabelas-fonte via Supabase Realtime
 * e invalida o cache do React Query — todos os dashboards, KPIs, DRE e fluxo
 * de caixa abertos recalculam imediatamente, em qualquer aba e para qualquer
 * usuário.
 */
export function useRealtimeInvalidator() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("global-recalc");

    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          // Invalida tudo — agregadores derivam de várias tabelas e o custo
          // de refetch é baixo (consultas pequenas, indexadas).
          qc.invalidateQueries();
        },
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
