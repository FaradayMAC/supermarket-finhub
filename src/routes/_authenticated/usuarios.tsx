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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth, MODULO_LABEL, MODULO_GRUPO, TODOS_MODULOS, type ModuloId } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, Pencil, KeyRound, Trash2, ShieldCheck, ShieldOff, Crown } from "lucide-react";
import { adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetPassword, adminSetApproved } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · MercadoGest" }] }),
  component: Usuarios,
});

const GRUPOS = ["Financeiro", "Relatórios", "Pessoas (RH)", "Administração"];

function msgErro(e: any) {
  const m = String(e?.message ?? e ?? "Erro inesperado");
  if (/weak and easy to guess|pwned|leaked/i.test(m))
    return "Senha muito fraca ou vazada. Use uma senha mais forte (evite sequências e palavras comuns).";
  if (/at least 6 characters|Password should be/i.test(m)) return "A senha deve ter no mínimo 6 caracteres.";
  if (/already registered|already been registered/i.test(m)) return "Já existe um usuário com este e-mail.";
  return m;
}

function ModulosPicker({ value, onChange }: { value: ModuloId[]; onChange: (v: ModuloId[]) => void }) {
  const toggle = (m: ModuloId) =>
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Módulos liberados</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...TODOS_MODULOS])}>Todos</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([])}>Nenhum</Button>
        </div>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
        {GRUPOS.map((g) => (
          <div key={g}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</div>
            <div className="grid grid-cols-2 gap-2">
              {TODOS_MODULOS.filter((m) => MODULO_GRUPO[m] === g).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={value.includes(m)} onCheckedChange={() => toggle(m)} />
                  {MODULO_LABEL[m]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Usuarios() {
  const auth = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const resetFn = useServerFn(adminResetPassword);
  const approveFn = useServerFn(adminSetApproved);
  const podeGerir = auth.can("usuarios");

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios-admin"],
    enabled: podeGerir,
    queryFn: async () => {
      const [{ data: profiles }, { data: mods }, { data: lojas }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, loja_id, approved, admin_master, created_at").order("created_at", { ascending: false }),
        supabase.from("usuario_modulos").select("usuario_id, modulo_id"),
        supabase.from("lojas").select("id, codigo, nome"),
      ]);
      return { profiles: profiles ?? [], mods: mods ?? [], lojas: lojas ?? [] };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["usuarios-admin"] });
    qc.invalidateQueries({ queryKey: ["auth-context"] });
  };

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

  if (!podeGerir) {
    return <AppShell title="Usuários"><Card><CardContent className="p-8 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></AppShell>;
  }

  const modsByUser = new Map<string, ModuloId[]>();
  (data?.mods ?? []).forEach((m: any) => {
    modsByUser.set(m.usuario_id, [...(modsByUser.get(m.usuario_id) ?? []), m.modulo_id as ModuloId]);
  });
  const lojas = data?.lojas ?? [];

  return (
    <AppShell title="Usuários e permissões">
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
                  <th className="px-4 py-3">Módulos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.profiles ?? []).map((p: any) => {
                  const mods = modsByUser.get(p.id) ?? [];
                  const isSelf = p.id === auth.user?.id;
                  const master = !!p.admin_master;
                  const approved = !!p.approved;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {p.nome ?? "—"}
                          {isSelf && <Badge variant="secondary" className="ml-2">você</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {master ? (
                          <Badge className="gap-1"><Crown className="h-3 w-3" /> Admin Master · acesso total</Badge>
                        ) : mods.length === 0 ? (
                          <Badge variant="outline">Sem acesso</Badge>
                        ) : (
                          <div className="flex max-w-md flex-wrap gap-1">
                            {mods.map((m) => <Badge key={m} variant="secondary">{MODULO_LABEL[m]}</Badge>)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {approved
                          ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aprovado</Badge>
                          : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Aguardando aprovação</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const loja = lojas.find((l: any) => l.id === p.loja_id);
                          return loja ? `${loja.codigo} — ${loja.nome}` : <span className="text-xs text-muted-foreground">todas</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {!isSelf && !master && (
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
                          {(!master || isSelf) && (
                            <EditUserDialog user={p} mods={mods} master={master} lojas={lojas} onSubmit={(v) => updateMut.mutateAsync({ userId: p.id, ...v })} />
                          )}
                          {(!master || isSelf) && (
                            <ResetPasswordDialog email={p.email} onSubmit={(pwd) => resetMut.mutateAsync({ userId: p.id, password: pwd })} />
                          )}
                          {!isSelf && !master && (
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

function LojaSelect({ value, onChange, lojas }: { value: string; onChange: (v: string) => void; lojas: any[] }) {
  return (
    <div>
      <Label>Unidade (opcional — restringe os dados a uma loja)</Label>
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Todas as lojas</SelectItem>
          {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.codigo} — {l.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateUserDialog({ lojas, onSubmit }: { lojas: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "", loja_id: "" });
  const [modulos, setModulos] = useState<ModuloId[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...form, loja_id: form.loja_id || null, modulos });
      setOpen(false);
      setForm({ nome: "", email: "", password: "", loja_id: "" });
      setModulos([]);
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
          <LojaSelect value={form.loja_id} onChange={(v) => setForm({ ...form, loja_id: v })} lojas={lojas} />
          <ModulosPicker value={modulos} onChange={setModulos} />
          <DialogFooter><Button type="submit" disabled={busy}>Criar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, mods, master, lojas, onSubmit }: { user: any; mods: ModuloId[]; master: boolean; lojas: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: user.nome ?? "", email: user.email ?? "", loja_id: user.loja_id ?? "" });
  const [modulos, setModulos] = useState<ModuloId[]>(mods);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        nome: form.nome,
        email: form.email,
        loja_id: form.loja_id || null,
        ...(master ? {} : { modulos }),
      });
      setOpen(false);
    } catch { /* erro já exibido via toast */ } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setModulos(mods); }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <LojaSelect value={form.loja_id} onChange={(v) => setForm({ ...form, loja_id: v })} lojas={lojas} />
          {master ? (
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Admin Master tem acesso a todos os módulos permanentemente.
            </p>
          ) : (
            <ModulosPicker value={modulos} onChange={setModulos} />
          )}
          <DialogFooter><Button type="submit" disabled={busy}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ email, onSubmit }: { email: string; onSubmit: (pwd: string) => Promise<any> }) {
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
