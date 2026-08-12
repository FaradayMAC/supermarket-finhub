import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth, ROLE_LABEL, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, Pencil, KeyRound, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetPassword, adminSetApproved } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · MercadoGest" }] }),
  component: Usuarios,
});

const ROLES: AppRole[] = ["admin", "diretoria", "controladoria", "gerente"];

function msgErro(e: any) {
  const m = String(e?.message ?? e ?? "Erro inesperado");
  if (/weak and easy to guess|pwned|leaked/i.test(m))
    return "Senha muito fraca ou vazada. Use uma senha mais forte (evite sequências e palavras comuns).";
  if (/at least 6 characters|Password should be/i.test(m)) return "A senha deve ter no mínimo 6 caracteres.";
  if (/already registered|already been registered/i.test(m)) return "Já existe um usuário com este e-mail.";
  return m;
}

function Usuarios() {
  const auth = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const resetFn = useServerFn(adminResetPassword);
  const approveFn = useServerFn(adminSetApproved);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios-admin"],
    enabled: auth.isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: lojas }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, loja_id, approved, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("lojas").select("id, codigo, nome"),
      ]);
      return { profiles: profiles ?? [], roles: roles ?? [], lojas: lojas ?? [] };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["usuarios-admin"] });

  const createMut = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Usuário criado"); },
    onError: (e: any) => toast.error(msgErro(e)),
  });
  const updateMut = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Usuário atualizado"); },
    onError: (e: any) => toast.error(msgErro(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => { invalidate(); toast.success("Usuário excluído"); },
    onError: (e: any) => toast.error(msgErro(e)),
  });
  const resetMut = useMutation({
    mutationFn: (v: { userId: string; password: string }) => resetFn({ data: v }),
    onSuccess: () => toast.success("Senha redefinida"),
    onError: (e: any) => toast.error(msgErro(e)),
  });
  const approveMut = useMutation({
    mutationFn: (v: { userId: string; approved: boolean }) => approveFn({ data: v }),
    onSuccess: (_d, v) => { invalidate(); toast.success(v.approved ? "Usuário aprovado" : "Acesso revogado"); },
    onError: (e: any) => toast.error(msgErro(e)),
  });

  if (!auth.isAdmin) {
    return <AppShell title="Usuários"><Card><CardContent className="p-8 text-center text-muted-foreground">Acesso restrito ao Administrador.</CardContent></Card></AppShell>;
  }

  const rolesByUser = new Map<string, AppRole>();
  (data?.roles ?? []).forEach((r: any) => rolesByUser.set(r.user_id, r.role));
  const lojas = data?.lojas ?? [];

  return (
    <AppShell title="Usuários e perfis">
      <div className="mb-4 flex justify-end">
        <CreateUserDialog lojas={lojas} onSubmit={(v) => createMut.mutateAsync(v)} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? <div className="p-6 text-muted-foreground">Carregando…</div> : (
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Unidade (gerentes)</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.profiles ?? []).map((p: any) => {
                  const r = rolesByUser.get(p.id) ?? null;
                  const isSelf = p.id === auth.user?.id;
                  const approved = !!p.approved;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.nome ?? "—"} {isSelf && <Badge variant="secondary" className="ml-2">você</Badge>}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r ? <Badge>{ROLE_LABEL[r]}</Badge> : <Badge variant="outline">Sem acesso</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {approved
                          ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aprovado</Badge>
                          : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Aguardando aprovação</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          if (r !== "gerente") return <span className="text-xs text-muted-foreground">—</span>;
                          const loja = lojas.find((l: any) => l.id === p.loja_id);
                          return loja ? `${loja.codigo} — ${loja.nome}` : <span className="text-xs text-muted-foreground">não vinculada</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {!isSelf && (
                            approved ? (
                              <Button variant="ghost" size="icon" title="Revogar acesso" onClick={() => approveMut.mutate({ userId: p.id, approved: false })}>
                                <ShieldOff className="h-4 w-4 text-amber-600" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" title="Aprovar acesso" onClick={() => approveMut.mutate({ userId: p.id, approved: true })}>
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )
                          )}
                          <EditUserDialog user={p} currentRole={r} lojas={lojas} onSubmit={(v) => updateMut.mutateAsync({ userId: p.id, ...v })} />
                          <ResetPasswordDialog userId={p.id} email={p.email} onSubmit={(pwd) => resetMut.mutateAsync({ userId: p.id, password: pwd })} />
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação remove permanentemente {p.email} do sistema.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMut.mutate(p.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
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

function CreateUserDialog({ lojas, onSubmit }: { lojas: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "", role: "gerente" as AppRole, loja_id: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...form, loja_id: form.role === "gerente" ? (form.loja_id || null) : null });
      setOpen(false);
      setForm({ nome: "", email: "", password: "", role: "gerente", loja_id: "" });
    } catch { /* erro já exibido via toast */ } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo usuário</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><Label>Senha</Label><Input type="text" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div>
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.role === "gerente" && (
            <div>
              <Label>Unidade</Label>
              <Select value={form.loja_id} onValueChange={(v) => setForm({ ...form, loja_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular loja" /></SelectTrigger>
                <SelectContent>{lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.codigo} — {l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter><Button type="submit" disabled={busy}>Criar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, currentRole, lojas, onSubmit }: { user: any; currentRole: AppRole | null; lojas: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: user.nome ?? "", email: user.email ?? "", role: (currentRole ?? "gerente") as AppRole, loja_id: user.loja_id ?? "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ nome: form.nome, email: form.email, role: form.role, loja_id: form.role === "gerente" ? (form.loja_id || null) : null });
      setOpen(false);
    } catch { /* erro já exibido via toast */ } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div>
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.role === "gerente" && (
            <div>
              <Label>Unidade</Label>
              <Select value={form.loja_id} onValueChange={(v) => setForm({ ...form, loja_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular loja" /></SelectTrigger>
                <SelectContent>{lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.codigo} — {l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter><Button type="submit" disabled={busy}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, email, onSubmit }: { userId: string; email: string; onSubmit: (pwd: string) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(pwd); setOpen(false); setPwd(""); } catch { /* erro já exibido via toast */ } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Redefinir senha"><KeyRound className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Redefinir senha</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">Definir nova senha para <b>{email}</b>.</p>
          <div><Label>Nova senha</Label><Input type="text" minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} required /></div>
          <DialogFooter><Button type="submit" disabled={busy}>Salvar senha</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
