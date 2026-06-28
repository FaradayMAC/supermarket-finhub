import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({ meta: [{ title: "Metas · MercadoGest" }] }),
  component: MetasPage,
});

type Meta = {
  id: string;
  loja_id: string | null;
  categoria_id: string | null;
  tipo: string;
  descricao: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  valor_meta: number;
  status: string;
};

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthRange = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const inicio = `${y}-${String(m).padStart(2, "0")}-01`;
  const fimD = new Date(y, m, 0);
  const fim = `${fimD.getFullYear()}-${String(fimD.getMonth() + 1).padStart(2, "0")}-${String(fimD.getDate()).padStart(2, "0")}`;
  return { inicio, fim };
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

function MetasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meta | null>(null);
  const [mes, setMes] = useState(monthKey());

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias_despesa").select("id, nome").order("nome")).data ?? [],
  });
  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("periodo_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Meta[];
    },
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas-all"],
    queryFn: async () =>
      (await supabase.from("despesas").select("loja_id, categoria_id, valor, data_competencia")).data ?? [],
  });

  const lojaMap = useMemo(() => new Map((lojas as any[]).map((l) => [l.id, l])), [lojas]);
  const catMap = useMemo(() => new Map((cats as any[]).map((c) => [c.id, c])), [cats]);

  const realizado = (m: Meta) =>
    (despesas as any[])
      .filter((d) => {
        if (d.data_competencia < m.periodo_inicio || d.data_competencia > m.periodo_fim) return false;
        if (m.loja_id && d.loja_id !== m.loja_id) return false;
        if (m.categoria_id && d.categoria_id !== m.categoria_id) return false;
        return true;
      })
      .reduce((s, d) => s + Number(d.valor), 0);

  const metasMes = useMemo(
    () => metas.filter((m) => m.periodo_inicio.slice(0, 7) === mes),
    [metas, mes],
  );

  const upsert = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("metas").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Meta atualizada" : "Meta cadastrada");
      qc.invalidateQueries({ queryKey: ["metas"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta removida");
      qc.invalidateQueries({ queryKey: ["metas"] });
    },
  });

  const totalMeta = metasMes.reduce((s, m) => s + Number(m.valor_meta), 0);
  const totalReal = metasMes.reduce((s, m) => s + realizado(m), 0);
  const pctTotal = totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;

  // Lista de meses (3 anteriores → 3 futuros)
  const mesesOpts = useMemo(() => {
    const out: string[] = [];
    const base = new Date();
    base.setDate(1);
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      out.push(monthKey(d));
    }
    return out;
  }, []);

  return (
    <AppShell
      title="Metas de despesa"
      actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Nova meta</Button>
          </DialogTrigger>
          <MetaForm
            key={editing?.id ?? mes}
            lojas={lojas as any}
            categorias={cats as any}
            initial={editing}
            defaultMonth={mes}
            onSubmit={(v) => upsert.mutate(editing ? { ...v, id: editing.id } : v)}
            saving={upsert.isPending}
          />
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase text-muted-foreground">Mês:</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {mesesOpts.map((k) => <SelectItem key={k} value={k} className="capitalize">{monthLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {metasMes.length} meta(s) · Meta total <span className="font-semibold text-foreground">{fmtBRL(totalMeta)}</span> · Realizado <span className={`font-semibold ${pctTotal > 100 ? "text-destructive" : "text-foreground"}`}>{fmtBRL(totalReal)}</span>
        </div>
      </div>

      {totalMeta > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium capitalize">Consolidado · {monthLabel(mes)}</span>
              <span className={pctTotal > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {pctTotal.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(pctTotal, 100)} className={pctTotal > 100 ? "[&>div]:bg-destructive" : pctTotal >= 80 ? "[&>div]:bg-warning" : ""} />
          </CardContent>
        </Card>
      )}

      {lojas.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre uma loja para definir metas.</CardContent></Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : metasMes.length === 0 && lojas.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Sem metas para {monthLabel(mes)}. Clique em "Nova meta".
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {metasMes.map((m) => {
            const real = realizado(m);
            const pct = Number(m.valor_meta) > 0 ? (real / Number(m.valor_meta)) * 100 : 0;
            const restante = Number(m.valor_meta) - real;
            const escopo: string[] = [];
            escopo.push(m.loja_id ? (lojaMap.get(m.loja_id) as any)?.nome ?? "Loja" : "Todas as lojas");
            escopo.push(m.categoria_id ? (catMap.get(m.categoria_id) as any)?.nome ?? "Categoria" : "Todas as categorias");
            const corBarra = pct > 100 ? "[&>div]:bg-destructive" : pct >= 80 ? "[&>div]:bg-warning" : "";
            const corPct = pct > 100 ? "text-destructive" : pct >= 80 ? "text-warning-foreground" : "text-muted-foreground";
            return (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.descricao || escopo.join(" · ")}</div>
                      <div className="text-xs text-muted-foreground">{escopo.join(" · ")}</div>
                    </div>
                    <div className="flex shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span><span className="text-muted-foreground">Realizado</span> <b>{fmtBRL(real)}</b> <span className="text-muted-foreground">/ {fmtBRL(Number(m.valor_meta))}</span></span>
                    <span className={`font-semibold ${corPct}`}>{pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className={`mt-2 ${corBarra}`} />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {restante >= 0 ? `Restam ${fmtBRL(restante)} no orçamento` : <span className="text-destructive font-medium">Excedeu em {fmtBRL(-restante)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function MetaForm({
  lojas, categorias, initial, defaultMonth, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string }[];
  categorias: { id: string; nome: string }[];
  initial: Meta | null;
  defaultMonth: string;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const initMonth = initial?.periodo_inicio?.slice(0, 7) ?? defaultMonth;
  const [lojaId, setLojaId] = useState(initial?.loja_id ?? "todas");
  const [catId, setCatId] = useState(initial?.categoria_id ?? "todas");
  const [competencia, setCompetencia] = useState(initMonth);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar meta" : "Nova meta de despesa"}</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const valor = Number(fd.get("valor"));
          if (!valor || valor <= 0) return toast.error("Informe o valor da meta");
          const { inicio, fim } = monthRange(competencia);
          const escopo = lojaId !== "todas" && catId !== "todas" ? "despesa_loja_categoria"
            : catId !== "todas" ? "despesa_categoria"
            : lojaId !== "todas" ? "despesa_loja" : "despesa_geral";
          onSubmit({
            loja_id: lojaId === "todas" ? null : lojaId,
            categoria_id: catId === "todas" ? null : catId,
            tipo: escopo,
            descricao: String(fd.get("descricao") || "").trim() || null,
            periodo_inicio: inicio,
            periodo_fim: fim,
            valor_meta: valor,
            status: "em_andamento",
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Unidade</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mes">Mês *</Label>
            <Input id="mes" type="month" required value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="valor">Limite de despesa (R$) *</Label>
            <Input id="valor" name="valor" type="number" step="0.01" min="0" required defaultValue={initial?.valor_meta ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" maxLength={200} placeholder="Opcional" defaultValue={initial?.descricao ?? ""} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
