import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SALARIO_MINIMO } from "@/lib/cargos";

const CHAVE = "salario_minimo";

/** Salário mínimo de referência, editável pelo usuário e usado em todos os cálculos. */
export function useSalarioMinimo() {
  const { data, isLoading } = useQuery({
    queryKey: ["config", CHAVE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", CHAVE)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.valor ?? SALARIO_MINIMO);
    },
  });

  return { salarioMinimo: Number(data ?? SALARIO_MINIMO), isLoading };
}

export function useSalvarSalarioMinimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave: CHAVE, valor }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
