import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_LABEL, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · MercadoGest" }] }),
  component: Usuarios,
});

const ROLES: AppRole[] = ["admin", "diretoria", "controladoria", "gerente"];

function Usuarios() {
  const auth = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios-admin"],
    enabled: auth.isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: lojas }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, loja_id, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("lojas").select("id, codigo, nome"),
      ]);
      return { profiles: profiles ?? [], roles: roles ?? [], lojas: lojas ?? [] };
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios-admin"] }); toast.success("Perfil atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const setLoja = useMutation({
    mutationFn: async ({ userId, lojaId }: { userId: string; lojaId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ loja_id: lojaId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios-admin"] }); toast.success("Unidade vinculada"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!auth.isAdmin) {
    return <AppShell title="Usuários"><Card><CardContent className="p-8 text-center text-muted-foreground">Acesso restrito ao Administrador.</CardContent></Card></AppShell>;
  }

  const rolesByUser = new Map<string, AppRole>();
  (data?.roles ?? []).forEach((r: any) => rolesByUser.set(r.user_id, r.role));

  return (
    <AppShell title="Usuários e perfis">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? <div className="p-6 text-muted-foreground">Carregando…</div> : (
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Unidade (gerentes)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.profiles ?? []).map((p: any) => {
                  const r = rolesByUser.get(p.id) ?? null;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Select value={r ?? ""} onValueChange={(v) => setRole.mutate({ userId: p.id, role: v as AppRole })}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Sem perfil" /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((rr) => <SelectItem key={rr} value={rr}>{ROLE_LABEL[rr]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {!r && <Badge variant="outline">Sem acesso</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r === "gerente" ? (
                          <Select value={p.loja_id ?? ""} onValueChange={(v) => setLoja.mutate({ userId: p.id, lojaId: v || null })}>
                            <SelectTrigger className="w-56"><SelectValue placeholder="Vincular loja" /></SelectTrigger>
                            <SelectContent>
                              {(data?.lojas ?? []).map((l: any) => (
                                <SelectItem key={l.id} value={l.id}>{l.codigo} — {l.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
