import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, usePeriodo } from "@/components/period-filter";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({ meta: [{ title: "Fluxo de Caixa · MercadoGest" }] }),
  component: CaixaPage,
});

type Mov = {
  id: string;
  loja_id: string | null;
  tipo: string;
  valor: number;
  descricao: string;
  data_movimentacao: string;
  status: string;
  forma_pagamento: string | null;
  origem: string | null;
  conta: string | null;
  lojas?: { nome: string; codigo: string };
};

const FORMAS = ["Dinheiro", "PIX", "Boleto", "Cartão", "Transferência", "Outro"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CaixaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const periodoState = usePeriodo("1m");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["mov-caixa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_financeiras")
        .select("*, lojas(nome, codigo)")
        .order("data_movimentacao", { ascending: false });
      if (error) throw error;
      return (data as any) as Mov[];
    },
  });

  const { inWindow, meses: monthsBack } = periodoState;

  const filtradas = useMemo(() => {
    return movs.filter((m) => {
      if (filtroLoja !== "todas" && m.loja_id !== filtroLoja) return false;
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (!inWindow(m.data_movimentacao)) return false;
      return true;
    });
  }, [movs, filtroLoja, filtroTipo, periodoState.from, periodoState.to]);

  const entradas = filtradas.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
  const saidas = filtradas.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.valor), 0);
  const saldo = entradas - saidas;

  // Saldo atual da conta (todo o histórico confirmado, respeitando a unidade)
  const hojeISO = new Date().toISOString().slice(0, 10);
  const saldoAtual = useMemo(() => {
    return movs.reduce((s, m) => {
      if (filtroLoja !== "todas" && m.loja_id !== filtroLoja) return s;
      if (m.status !== "confirmado") return s;
      if ((m.data_movimentacao ?? "").slice(0, 10) > hojeISO) return s;
      return s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor));
    }, 0);
  }, [movs, filtroLoja, hojeISO]);

  // Evolução mensal
  const monthly = useMemo(() => {
    const mb = monthsBack;
    const base = new Date();
    base.setDate(1);
    const out: { key: string; label: string; entradas: number; saidas: number; saldo: number; acumulado: number }[] = [];
    for (let i = mb - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = monthKey(d);
      out.push({
        key,
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        entradas: 0, saidas: 0, saldo: 0, acumulado: 0,
      });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    filtradas.forEach((m) => {
      const i = idx.get((m.data_movimentacao ?? "").slice(0, 7));
      if (i == null) return;
      if (m.tipo === "entrada") out[i].entradas += Number(m.valor);
      else if (m.tipo === "saida") out[i].saidas += Number(m.valor);
    });
    let acc = 0;
    out.forEach((r) => { r.saldo = r.entradas - r.saidas; acc += r.saldo; r.acumulado = acc; });
    return out;
  }, [filtradas, monthsBack]);

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("movimentacoes_financeiras").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação lançada");
      qc.invalidateQueries({ queryKey: ["mov-caixa"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentacoes_financeiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação removida");
      qc.invalidateQueries({ queryKey: ["mov-caixa"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload: any = {
      tipo: f.get("tipo"),
      loja_id: f.get("loja_id") || null,
      descricao: f.get("descricao"),
      valor: Number(f.get("valor") || 0),
      data_movimentacao: f.get("data_movimentacao"),
      forma_pagamento: (f.get("forma_pagamento") as string) || null,
      conta: (f.get("conta") as string) || null,
      status: (f.get("status") as string) || "confirmado",
      origem: "manual",
    };
    if (!payload.descricao || !payload.valor || !payload.data_movimentacao) {
      toast.error("Preencha descrição, valor e data");
      return;
    }
    create.mutate(payload);
  }

  return (
    <AppShell
      title="Fluxo de Caixa"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova movimentação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Lançar movimentação</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select name="tipo" defaultValue="entrada">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select name="status" defaultValue="confirmado">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="previsto">Previsto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select name="loja_id">
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input name="descricao" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input name="valor" type="number" step="0.01" required />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input name="data_movimentacao" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Forma de pagamento</Label>
                  <Select name="forma_pagamento">
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input name="conta" placeholder="Ex: Itaú, Caixa..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Unidade</Label>
              <Select value={filtroLoja} onValueChange={setFiltroLoja}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as unidades</SelectItem>
                  {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Período</Label>
              <PeriodFilter state={periodoState} showLabel={false} />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="realizado">
          <TabsList>
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="projetado">Projetado</TabsTrigger>
            <TabsTrigger value="cofre">Cofre</TabsTrigger>
          </TabsList>

          <TabsContent value="realizado" className="mt-4 space-y-6">
        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="Entradas" value={fmtBRL(entradas)} accent="success" />
          <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="Saídas" value={fmtBRL(saidas)} accent="destructive" />
          <Kpi icon={<Wallet className="h-4 w-4" />} label="Saldo do período" value={fmtBRL(saldo)} accent={saldo >= 0 ? "success" : "destructive"} />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Lançamentos" value={String(filtradas.length)} />
        </div>

        {/* Gráfico evolução */}
        <Card>
          <CardHeader><CardTitle>Evolução mensal</CardTitle></CardHeader>
          <CardContent className="h-80">
            {monthly.every((m) => m.entradas === 0 && m.saidas === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem movimentações no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="entradas" fill="var(--color-chart-2)" name="Entradas" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" fill="var(--color-chart-1)" name="Saídas" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Saldo acumulado */}
        <Card>
          <CardHeader><CardTitle>Saldo acumulado</CardTitle></CardHeader>
          <CardContent className="h-72">
            {monthly.every((m) => m.acumulado === 0) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="acumulado" stroke="var(--color-chart-5)" strokeWidth={2} name="Acumulado" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader><CardTitle>Movimentações</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Forma</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>)}
                {!isLoading && filtradas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação no filtro.</td></tr>
                )}
                {filtradas.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(m.data_movimentacao).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      {m.tipo === "entrada"
                        ? <Badge className="bg-success/10 text-success hover:bg-success/10"><ArrowUpRight className="mr-1 h-3 w-3" />Entrada</Badge>
                        : <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10"><ArrowDownRight className="mr-1 h-3 w-3" />Saída</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.descricao}</div>
                      {m.origem && m.origem !== "manual" && (
                        <div className="text-xs text-muted-foreground">origem: {m.origem}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.lojas?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.forma_pagamento ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{m.status}</Badge></td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {m.tipo === "entrada" ? "+" : "−"} {fmtBRL(Number(m.valor))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir movimentação?")) del.mutate(m.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="projetado" className="mt-4">
            <Projecao lojaId={filtroLoja} saldoAtual={saldoAtual} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "success" | "destructive";
}) {
  const color = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={color}>{icon}</span>{label}
        </div>
        <div className={`mt-2 text-2xl font-bold tracking-tight ${accent ? color : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

type Titulo = {
  id: string;
  tipo: string;
  loja_id: string | null;
  descricao: string;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  status: string;
  numero_parcela: number;
  total_parcelas: number;
  lojas?: { nome: string } | null;
};

function Projecao({ lojaId, saldoAtual }: { lojaId: string; saldoAtual: number }) {
  const [horizonte, setHorizonte] = useState("6");
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: titulos = [], isLoading } = useQuery({
    queryKey: ["titulos-projecao", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titulos_financeiros")
        .select("id, tipo, loja_id, descricao, valor, valor_pago, data_vencimento, status, numero_parcela, total_parcelas, lojas(nome)")
        .in("status", ["aberto", "parcial"])
        .gte("data_vencimento", hoje)
        .order("data_vencimento");
      if (error) throw error;
      return (data as any) as Titulo[];
    },
  });

  const meses = Number(horizonte);

  const filtrados = useMemo(
    () => titulos.filter((t) => lojaId === "todas" || t.loja_id === lojaId),
    [titulos, lojaId],
  );

  const saldoAberto = (t: Titulo) => Math.max(0, Number(t.valor) - Number(t.valor_pago ?? 0));

  const projecao = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    const out: { key: string; label: string; receber: number; pagar: number; liquido: number; acumulado: number }[] = [];
    for (let i = 0; i < meses; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      out.push({
        key: monthKey(d),
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        receber: 0, pagar: 0, liquido: 0, acumulado: 0,
      });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    filtrados.forEach((t) => {
      const i = idx.get((t.data_vencimento ?? "").slice(0, 7));
      if (i == null) return;
      if (t.tipo === "receber") out[i].receber += saldoAberto(t);
      else out[i].pagar += saldoAberto(t);
    });
    let acc = saldoAtual;
    out.forEach((r) => { r.liquido = r.receber - r.pagar; acc += r.liquido; r.acumulado = acc; });
    return out;
  }, [filtrados, meses, saldoAtual]);

  const dentroHorizonte = useMemo(() => {
    const chaves = new Set(projecao.map((p) => p.key));
    return filtrados.filter((t) => chaves.has((t.data_vencimento ?? "").slice(0, 7)));
  }, [filtrados, projecao]);

  const totalReceber = projecao.reduce((s, p) => s + p.receber, 0);
  const totalPagar = projecao.reduce((s, p) => s + p.pagar, 0);
  const saldoFinal = projecao.length ? projecao[projecao.length - 1].acumulado : saldoAtual;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Projeção baseada em títulos em aberto ou parciais com vencimento a partir de hoje.
        </p>
        <Select value={horizonte} onValueChange={setHorizonte}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Próximos 3 meses</SelectItem>
            <SelectItem value="6">Próximos 6 meses</SelectItem>
            <SelectItem value="12">Próximos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Saldo atual" value={fmtBRL(saldoAtual)} accent={saldoAtual >= 0 ? "success" : "destructive"} />
        <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="A receber" value={fmtBRL(totalReceber)} accent="success" />
        <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="A pagar" value={fmtBRL(totalPagar)} accent="destructive" />
        <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Saldo projetado" value={fmtBRL(saldoFinal)} accent={saldoFinal >= 0 ? "success" : "destructive"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Projeção mensal</CardTitle></CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando…</div>
          ) : projecao.every((p) => p.receber === 0 && p.pagar === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhum título em aberto no horizonte</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projecao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="receber" fill="var(--color-chart-2)" name="A receber" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pagar" fill="var(--color-chart-1)" name="A pagar" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Saldo projetado acumulado</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projecao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="acumulado" stroke="var(--color-chart-5)" strokeWidth={2} name="Saldo projetado" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Títulos previstos</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>)}
              {!isLoading && dentroHorizonte.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum título previsto.</td></tr>
              )}
              {dentroHorizonte.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.data_vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    {t.tipo === "receber"
                      ? <Badge className="bg-success/10 text-success hover:bg-success/10">A receber</Badge>
                      : <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">A pagar</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.descricao}</div>
                    {t.total_parcelas > 1 && (
                      <div className="text-xs text-muted-foreground">parcela {t.numero_parcela}/{t.total_parcelas}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.lojas?.nome ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{t.status}</Badge></td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.tipo === "receber" ? "text-success" : "text-destructive"}`}>
                    {fmtBRL(saldoAberto(t))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
