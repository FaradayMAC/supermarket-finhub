import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários · MercadoGest" }] }),
  component: FuncPage,
});

type Func = {
  id: string;
  loja_id: string;
  nome: string;
  cargo: string | null;
  salario_base: number;
  encargos: number;
  beneficios: number;
  data_admissao: string | null;
  ativo: boolean;
  lojas?: { nome: string; codigo: string };
};

function FuncPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("todas");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });

  const { data: funcs = [], isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("*, lojas(nome, codigo)").order("nome");
      if (error) throw error;
      return data as any as Func[];
    },
  });

  const filtrados = useMemo(
    () => (filtro === "todas" ? funcs : funcs.filter((f) => f.loja_id === filtro)),
    [funcs, filtro],
  );
  const totalFolha = filtrados.reduce(
    (s, f) => s + Number(f.salario_base) + Number(f.encargos) + Number(f.beneficios),
    0,
  );

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("funcionarios").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funcionário cadastrado");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <AppShell
      title="Funcionários"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Novo funcionário</Button>
          </DialogTrigger>
          <FuncForm lojas={lojas as any} onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja:</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {(lojas as any[]).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          Folha total (filtrada): <span className="font-semibold text-foreground">{fmtBRL(totalFolha)}</span>
        </div>
      </div>

      {lojas.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre uma loja antes de adicionar funcionários.</CardContent></Card>
      )}

      {lojas.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3 text-right">Salário</th>
                  <th className="px-4 py-3 text-right">Encargos</th>
                  <th className="px-4 py-3 text-right">Benefícios</th>
                  <th className="px-4 py-3 text-right">Custo total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Sem funcionários neste filtro.</td></tr>
                )}
                {filtrados.map((f) => {
                  const total = Number(f.salario_base) + Number(f.encargos) + Number(f.beneficios);
                  return (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{f.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.cargo ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.lojas?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(Number(f.salario_base))}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(Number(f.encargos))}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(Number(f.beneficios))}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtBRL(total)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function FuncForm({
  lojas, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string }[];
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [lojaId, setLojaId] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!lojaId) return toast.error("Selecione a loja");
          const fd = new FormData(e.currentTarget);
          onSubmit({
            loja_id: lojaId,
            nome: String(fd.get("nome") || "").trim(),
            cargo: String(fd.get("cargo") || "").trim() || null,
            salario_base: Number(fd.get("salario") || 0),
            encargos: Number(fd.get("encargos") || 0),
            beneficios: Number(fd.get("beneficios") || 0),
            data_admissao: String(fd.get("admissao") || "") || null,
            ativo: true,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Loja *</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" name="nome" required maxLength={120} /></div>
          <div><Label htmlFor="cargo">Cargo</Label><Input id="cargo" name="cargo" maxLength={80} /></div>
          <div><Label htmlFor="admissao">Admissão</Label><Input id="admissao" name="admissao" type="date" /></div>
          <div><Label htmlFor="salario">Salário base (R$)</Label><Input id="salario" name="salario" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div><Label htmlFor="encargos">Encargos (R$)</Label><Input id="encargos" name="encargos" type="number" min="0" step="0.01" defaultValue="0" /></div>
          <div className="col-span-2"><Label htmlFor="beneficios">Benefícios (R$)</Label><Input id="beneficios" name="beneficios" type="number" min="0" step="0.01" defaultValue="0" /></div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
