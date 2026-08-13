import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type ModuloId =
  | "vendas" | "compras" | "despesas" | "caixa" | "titulos" | "conciliacao"
  | "impostos" | "metas" | "indicadores" | "dre" | "comparativo"
  | "funcionarios" | "cargos" | "faltas_rh" | "contracheque" | "rescisao"
  | "prestadores" | "lojas" | "usuarios";

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useAuth() {
  const { user, loading } = useAuthSession();

  const { data, isLoading } = useQuery({
    queryKey: ["auth-context", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: mods }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, loja_id, approved, admin_master").eq("id", user!.id).maybeSingle(),
        supabase.from("usuario_modulos").select("modulo_id").eq("usuario_id", user!.id),
      ]);
      return { profile, modulos: (mods ?? []).map((m: any) => m.modulo_id as ModuloId) };
    },
  });

  const adminMaster = !!(data?.profile as any)?.admin_master;
  const modulos: ModuloId[] = adminMaster
    ? (["vendas","compras","despesas","caixa","titulos","conciliacao","impostos","metas","indicadores","dre","comparativo","funcionarios","cargos","faltas_rh","contracheque","rescisao","prestadores","lojas","usuarios"] as ModuloId[])
    : (data?.modulos ?? []);

  const approved = !!data?.profile?.approved || adminMaster;
  const can = (m: ModuloId) => adminMaster || (approved && modulos.includes(m));

  return {
    user,
    loading: loading || isLoading,
    profile: data?.profile ?? null,
    adminMaster,
    modulos,
    can,
    lojaId: data?.profile?.loja_id ?? null,
    approved,
    hasAnyModule: adminMaster || modulos.length > 0,
  };
}

export const MODULO_LABEL: Record<ModuloId, string> = {
  vendas: "Vendas",
  compras: "Compras",
  despesas: "Despesas",
  caixa: "Caixa",
  titulos: "A pagar/receber",
  conciliacao: "Conciliação",
  impostos: "Impostos",
  metas: "Metas",
  indicadores: "Indicadores",
  dre: "DRE",
  comparativo: "Comparativo",
  funcionarios: "Funcionários",
  cargos: "Cargos",
  faltas_rh: "Faltas RH",
  contracheque: "Contra cheque",
  rescisao: "Rescisão",
  prestadores: "Prestadoras",
  lojas: "Lojas",
  usuarios: "Usuários",
};

export const MODULO_GRUPO: Record<ModuloId, string> = {
  vendas: "Financeiro", compras: "Financeiro", despesas: "Financeiro", caixa: "Financeiro",
  titulos: "Financeiro", conciliacao: "Financeiro", impostos: "Financeiro", metas: "Financeiro",
  indicadores: "Relatórios", dre: "Relatórios", comparativo: "Relatórios",
  funcionarios: "Pessoas (RH)", cargos: "Pessoas (RH)", faltas_rh: "Pessoas (RH)",
  contracheque: "Pessoas (RH)", rescisao: "Pessoas (RH)", prestadores: "Pessoas (RH)",
  lojas: "Administração", usuarios: "Administração",
};

export const TODOS_MODULOS = Object.keys(MODULO_LABEL) as ModuloId[];

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
