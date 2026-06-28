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

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({ meta: [{ title: "Despesas · MercadoGest" }] }),
  component: DespesasPage,
});

type Despesa = {
  id: string;
  loja_id: string;
  categoria_id: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  centro_custo: string | null;
  status: string;
  lojas?: { nome: string; codigo: string };
  categorias_despesa?: { nome: string };
};

function DespesasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias_despesa").select("id, nome").order("nome")).data ?? [],
  });
  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, lojas(nome, codigo), categorias_despesa(nome)")
        .order("data_competencia", { ascending: false });
      if (error) throw error;
      return (data as any) as Despesa[];
    },
  });

  const filtradas = useMemo(
    () => (filtroLoja === "todas" ? despesas : despesas.filter((d) => d.loja_id === filtroLoja)),
    [despesas, filtroLoja],
  );
  const total = filtradas.reduce((s, d) => s + Number(d.valor), 0);

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("despesas").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa lançada");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa removida");
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <AppShell
      title="Despesas operacionais"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Nova despesa</Button>
          </DialogTrigger>
          <DespesaForm lojas={lojas as any} categorias={cats as any} onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja:</Label>
          <Select value={filtroLoja} onValueChange={setFiltroLoja}>
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
          Total filtrado: <span className="font-semibold text-foreground">{fmtBRL(total)}</span>
        </div>
      </div>

      {lojas.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre uma loja antes de lançar despesas.</CardContent></Card>
      )}

      {lojas.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && filtradas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Sem despesas neste filtro.</td></tr>
                )}
                {filtradas.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(d.data_competencia).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">{d.lojas?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.categorias_despesa?.nome ?? "—"}</td>
                    <td className="px-4 py-3">{d.descricao}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "pago" ? "bg-success/15 text-success" : d.status === "pendente" ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmtBRL(Number(d.valor))}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function DespesaForm({
  lojas, categorias, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string }[];
  categorias: { id: string; nome: string }[];
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [lojaId, setLojaId] = useState("");
  const [catId, setCatId] = useState("");
  const [status, setStatus] = useState("pago");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!lojaId) return toast.error("Selecione a loja");
          onSubmit({
            loja_id: lojaId,
            categoria_id: catId || null,
            descricao: String(fd.get("descricao") || "").trim(),
            valor: Number(fd.get("valor")),
            data_competencia: String(fd.get("data") || ""),
            centro_custo: String(fd.get("centro") || "").trim() || null,
            status,
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
          <div>
            <Label>Categoria</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label htmlFor="descricao">Descrição *</Label><Input id="descricao" name="descricao" required maxLength={200} /></div>
          <div><Label htmlFor="valor">Valor (R$) *</Label><Input id="valor" name="valor" type="number" step="0.01" min="0" required /></div>
          <div><Label htmlFor="data">Data de competência *</Label><Input id="data" name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div className="col-span-2"><Label htmlFor="centro">Centro de custo</Label><Input id="centro" name="centro" maxLength={80} placeholder="Opcional" /></div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Lançar despesa"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
