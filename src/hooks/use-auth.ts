import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "diretoria" | "controladoria" | "gerente";

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
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, loja_id, approved").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      return { profile, roles: (roles ?? []).map((r: any) => r.role as AppRole) };
    },
  });

  const roles = data?.roles ?? [];
  const role: AppRole | null =
    roles.includes("admin") ? "admin"
    : roles.includes("controladoria") ? "controladoria"
    : roles.includes("diretoria") ? "diretoria"
    : roles.includes("gerente") ? "gerente"
    : null;

  const isAdmin = roles.includes("admin");
  const isDiretoria = roles.includes("diretoria");
  const isControladoria = roles.includes("controladoria");
  const isGerente = roles.includes("gerente");
  const canEditAll = isAdmin || isControladoria;
  const canViewAll = isAdmin || isControladoria || isDiretoria;
  const canEditOwnLoja = canEditAll || isGerente;
  const lojaId = data?.profile?.loja_id ?? null;
  const approved = !!data?.profile?.approved || isAdmin;

  return {
    user, loading: loading || isLoading,
    profile: data?.profile ?? null,
    roles, role,
    isAdmin, isDiretoria, isControladoria, isGerente,
    canEditAll, canViewAll, canEditOwnLoja,
    lojaId, approved,
  };
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  diretoria: "Diretoria",
  controladoria: "Controladoria",
  gerente: "Gerente de Unidade",
};

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
