import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PISO_COMERCIARIO_ES, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";
import {
  CHAVE_PLANO_ODONTO,
  CHAVE_PLANO_SAUDE_F1,
  CHAVE_PLANO_SAUDE_F2,
  type PlanosConfig,
} from "@/lib/planos";

export const CHAVE_SM_FEDERAL = "salario_minimo_federal";
export const CHAVE_PISO_ES = "piso_salarial_comerciario_es";

const CHAVES = [
  CHAVE_SM_FEDERAL,
  CHAVE_PISO_ES,
  CHAVE_PLANO_ODONTO,
  CHAVE_PLANO_SAUDE_F1,
  CHAVE_PLANO_SAUDE_F2,
];

/**
 * Valores de referência salarial:
 * - salário mínimo federal: base de quebra de caixa e insalubridade;
 * - piso do comerciário-ES: apenas referência de contratação, não entra em cálculo;
 * - planos de saúde/odontológico: valores globais aplicados a todos os funcionários.
 */
export function useReferenciasSalariais() {
  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes", "referencias-salariais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", CHAVES);
      if (error) throw error;
      const map = new Map((data ?? []).map((r: any) => [r.chave, Number(r.valor)]));
      return {
        salarioMinimoFederal: map.get(CHAVE_SM_FEDERAL) ?? SALARIO_MINIMO_FEDERAL,
        pisoComerciarioEs: map.get(CHAVE_PISO_ES) ?? PISO_COMERCIARIO_ES,
        planos: {
          odontologico: map.get(CHAVE_PLANO_ODONTO) ?? 0,
          saudeFaixa1: map.get(CHAVE_PLANO_SAUDE_F1) ?? 0,
          saudeFaixa2: map.get(CHAVE_PLANO_SAUDE_F2) ?? 0,
        } as PlanosConfig,
      };
    },
  });

  return {
    salarioMinimoFederal: data?.salarioMinimoFederal ?? SALARIO_MINIMO_FEDERAL,
    pisoComerciarioEs: data?.pisoComerciarioEs ?? PISO_COMERCIARIO_ES,
    planos: data?.planos ?? { odontologico: 0, saudeFaixa1: 0, saudeFaixa2: 0 },
    isLoading,
  };
}

export function useSalvarReferenciaSalarial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: number }) => {
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave, valor }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
