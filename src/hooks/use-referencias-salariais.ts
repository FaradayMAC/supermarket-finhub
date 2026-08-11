import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PISO_COMERCIARIO_ES, SALARIO_MINIMO_FEDERAL } from "@/lib/cargos";

export const CHAVE_SM_FEDERAL = "salario_minimo_federal";
export const CHAVE_PISO_ES = "piso_salarial_comerciario_es";

/**
 * Valores de referência salarial:
 * - salário mínimo federal: base de quebra de caixa e insalubridade;
 * - piso do comerciário-ES: apenas referência de contratação, não entra em cálculo.
 */
export function useReferenciasSalariais() {
  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes", "referencias-salariais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", [CHAVE_SM_FEDERAL, CHAVE_PISO_ES]);
      if (error) throw error;
      const map = new Map((data ?? []).map((r: any) => [r.chave, Number(r.valor)]));
      return {
        salarioMinimoFederal: map.get(CHAVE_SM_FEDERAL) ?? SALARIO_MINIMO_FEDERAL,
        pisoComerciarioEs: map.get(CHAVE_PISO_ES) ?? PISO_COMERCIARIO_ES,
      };
    },
  });

  return {
    salarioMinimoFederal: data?.salarioMinimoFederal ?? SALARIO_MINIMO_FEDERAL,
    pisoComerciarioEs: data?.pisoComerciarioEs ?? PISO_COMERCIARIO_ES,
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
