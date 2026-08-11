import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CUSTO_SELECT, custoReal } from "@/lib/custo-funcionario";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodFilter, usePeriodo } from "@/components/period-filter";
import { Plus, Trash2, Gauge, PackageX, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores operacionais · MercadoGest" },
      { name: "description", content: "Ticket médio real, percentual de perdas e quebras e ponto de equilíbrio (breakeven) por unidade da rede." },
      { property: "og:title", content: "Indicadores operacionais · MercadoGest" },
      { property: "og:description", content: "Ticket médio, perdas/quebras e breakeven por loja calculados a partir de vendas, compras e despesas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndicadoresPage,
});

const MOTIVOS: Record<string, string> = {
  vencimento: "Vencimento",
  avaria: "Avaria/quebra",
  furto: "Furto",
  inventario: "Ajuste de inventário",
  outros: "Outros",
};

const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const pctFmt = (v: number) => `${v.toFixed(2)}%`;

function IndicadoresPage() {
  const periodoState = usePeriodo("1m");
  const { inWindow, meses } = periodoState;

  const { data, isLoading } = useQuery({
    queryKey: ["indicadores"],
    queryFn: async () => {
      const [lojas, vendas, compras, despesas, impostos, folha, funcionarios, perdas] = await Promise.all([
        supabase.from("lojas").select("id, nome, codigo, ativo").order("nome"),
        supabase.from("vendas_diarias").select("loja_id, data, valor_total, qtd_cupons"),
        supabase.from("compras_mercadoria").select("loja_id, valor_total, data_compra"),
        supabase.from("despesas").select("loja_id, valor, data_competencia"),
        supabase.from("impostos").select("loja_id, valor, competencia"),
        supabase.from("folha_pagamento").select("funcionario_id, custo_total, competencia"),
        supabase.from("funcionarios").select(CUSTO_SELECT),
        supabase.from("perdas_estoque").select("*, lojas(nome, codigo)").order("data", { ascending: false }),
      ]);
      return {
        lojas: lojas.data ?? [],
        vendas: (vendas.data ?? []) as any[],
        compras: (compras.data ?? []) as any[],
        despesas: (despesas.data ?? []) as any[],
        impostos: (impostos.data ?? []) as any[],
        folha: (folha.data ?? []) as any[],
        funcionarios: (funcionarios.data ?? []) as any[],
        perdas: (perdas.data ?? []) as any[],
      };
    },
  });

  const linhas = (data?.lojas ?? []).map((l: any) => {
    const vendasLoja = (data?.vendas ?? []).filter((v) => v.loja_id === l.id && inWindow(v.data));
    const faturamento = vendasLoja.reduce((s, v) => s + Number(v.valor_total ?? 0), 0);
    const cupons = vendasLoja.reduce((s, v) => s + Number(v.qtd_cupons ?? 0), 0);
    const ticket = cupons > 0 ? faturamento / cupons : 0;

    const cmv = (data?.compras ?? [])
      .filter((c) => c.loja_id === l.id && inWindow(c.data_compra))
      .reduce((s, c) => s + Number(c.valor_total ?? 0), 0);
    const perdas = (data?.perdas ?? [])
      .filter((p) => p.loja_id === l.id && inWindow(p.data))
      .reduce((s, p) => s + Number(p.valor ?? 0), 0);
    const imp = (data?.impostos ?? [])
      .filter((i) => i.loja_id === l.id && inWindow(i.competencia))
      .reduce((s, i) => s + Number(i.valor ?? 0), 0);
    const despOp = (data?.despesas ?? [])
      .filter((d) => d.loja_id === l.id && inWindow(d.data_competencia))
      .reduce((s, d) => s + Number(d.valor ?? 0), 0);

    const funcsLoja = (data?.funcionarios ?? []).filter((f) => f.loja_id === l.id && f.ativo);
    const funcIds = new Set(funcsLoja.map((f: any) => f.id));
    const custoMensalFuncs = funcsLoja.reduce(
      (s, f) => s + custoReal(f, salarioMinimoFederal).total,
      0,
    );
    const folhaLanc = (data?.folha ?? []).filter((f) => funcIds.has(f.funcionario_id) && inWindow(f.competencia));
    const folhaTotal = folhaLanc.length > 0
      ? folhaLanc.reduce((s, f) => s + Number(f.custo_total ?? 0), 0)
      : custoMensalFuncs * meses;

    // Custos variáveis: CMV + impostos + perdas. Custos fixos: folha + despesas operacionais.
    const variaveis = cmv + imp + perdas;
    const fixos = folhaTotal + despOp;
    const mcPct = faturamento > 0 ? ((faturamento - variaveis) / faturamento) * 100 : 0;
    const breakeven = mcPct > 0 ? fixos / (mcPct / 100) : 0;
    const coberturaPct = breakeven > 0 ? (faturamento / breakeven) * 100 : 0;
    const perdasPct = faturamento > 0 ? (perdas / faturamento) * 100 : 0;
    const breakevenMes = meses > 0 ? breakeven / meses : breakeven;

    return {
      id: l.id, nome: l.nome, codigo: l.codigo,
      faturamento, cupons, ticket, cmv, perdas, perdasPct, imp, despOp,
      folha: folhaTotal, fixos, variaveis, mcPct, breakeven, breakevenMes, coberturaPct,
    };
  });

  const tot = linhas.reduce((a, r) => ({
    faturamento: a.faturamento + r.faturamento,
    cupons: a.cupons + r.cupons,
    perdas: a.perdas + r.perdas,
    fixos: a.fixos + r.fixos,
    variaveis: a.variaveis + r.variaveis,
  }), { faturamento: 0, cupons: 0, perdas: 0, fixos: 0, variaveis: 0 });

  const ticketRede = tot.cupons > 0 ? tot.faturamento / tot.cupons : 0;
  const perdasPctRede = tot.faturamento > 0 ? (tot.perdas / tot.faturamento) * 100 : 0;
  const mcPctRede = tot.faturamento > 0 ? ((tot.faturamento - tot.variaveis) / tot.faturamento) * 100 : 0;
  const breakevenRede = mcPctRede > 0 ? tot.fixos / (mcPctRede / 100) : 0;

  return (
    <AppShell title="Indicadores operacionais" actions={<PeriodFilter state={periodoState} />}>
      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Ticket médio real" value={fmtBRL(ticketRede)} hint={`${tot.cupons.toLocaleString("pt-BR")} cupons no período`} icon={Gauge} />
            <Kpi title="Perdas / quebras" value={fmtBRL(tot.perdas)} hint={`${pctFmt(perdasPctRede)} do faturamento`} icon={PackageX} />
            <Kpi title="Margem de contribuição" value={pctFmt(mcPctRede)} hint="Faturamento − CMV − impostos − perdas" icon={Target} />
            <Kpi title="Breakeven da rede" value={fmtBRL(breakevenRede)} hint={`Custos fixos ${fmtBRL(tot.fixos)}`} icon={Target} />
          </div>

          <Tabs defaultValue="ticket">
            <TabsList>
              <TabsTrigger value="ticket">Ticket médio</TabsTrigger>
              <TabsTrigger value="perdas">Perdas e quebras</TabsTrigger>
              <TabsTrigger value="breakeven">Breakeven</TabsTrigger>
            </TabsList>

            <TabsContent value="ticket" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Ticket médio por unidade</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Unidade</th>
                        <th className="px-4 py-3 text-right">Faturamento</th>
                        <th className="px-4 py-3 text-right">Cupons</th>
                        <th className="px-4 py-3 text-right">Ticket médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-3"><span className="font-medium">{r.codigo}</span> <span className="text-muted-foreground">{r.nome}</span></td>
                          <td className="px-4 py-3 text-right">{fmtBRL(r.faturamento)}</td>
                          <td className="px-4 py-3 text-right">{r.cupons.toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-3 text-right font-semibold">{r.cupons > 0 ? fmtBRL(r.ticket) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perdas" className="mt-4">
              <PerdasTab lojas={data?.lojas ?? []} perdas={data?.perdas ?? []} linhas={linhas} inWindow={inWindow} />
            </TabsContent>

            <TabsContent value="breakeven" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ponto de equilíbrio por unidade</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Breakeven = custos fixos (folha + despesas operacionais) ÷ margem de contribuição %. Variáveis: CMV, impostos e perdas.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Unidade</th>
                        <th className="px-4 py-3 text-right">Faturamento</th>
                        <th className="px-4 py-3 text-right">Custos fixos</th>
                        <th className="px-4 py-3 text-right">MC %</th>
                        <th className="px-4 py-3 text-right">Breakeven período</th>
                        <th className="px-4 py-3 text-right">Breakeven/mês</th>
                        <th className="px-4 py-3 text-right">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-3"><span className="font-medium">{r.codigo}</span> <span className="text-muted-foreground">{r.nome}</span></td>
                          <td className="px-4 py-3 text-right">{fmtBRL(r.faturamento)}</td>
                          <td className="px-4 py-3 text-right">{fmtBRL(r.fixos)}</td>
                          <td className="px-4 py-3 text-right">{r.faturamento > 0 ? pctFmt(r.mcPct) : "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold">{r.breakeven > 0 ? fmtBRL(r.breakeven) : "—"}</td>
                          <td className="px-4 py-3 text-right">{r.breakevenMes > 0 ? fmtBRL(r.breakevenMes) : "—"}</td>
                          <td className="px-4 py-3 text-right">
                            {r.breakeven > 0 ? (
                              <Badge variant={r.coberturaPct >= 100 ? "default" : "destructive"}>
                                {pctFmt(r.coberturaPct)} do PE
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ title, value, hint, icon: Icon }: { title: string; value: string; hint?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function PerdasTab({ lojas, perdas, linhas, inWindow }: { lojas: any[]; perdas: any[]; linhas: any[]; inWindow: (v?: string | null) => boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ loja_id: "", data: hojeISO(), valor: "", motivo: "avaria", categoria: "", observacoes: "" });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.loja_id) throw new Error("Selecione a loja");
      const loja = lojas.find((l) => l.id === form.loja_id);
      const { error } = await supabase.from("perdas_estoque").insert({
        loja_id: form.loja_id,
        empresa_id: loja?.empresa_id ?? null,
        data: form.data,
        valor: Number(form.valor || 0),
        motivo: form.motivo,
        categoria: form.categoria || null,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda registrada");
      setOpen(false);
      setForm({ loja_id: "", data: hojeISO(), valor: "", motivo: "avaria", categoria: "", observacoes: "" });
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("perdas_estoque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Registro removido"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const lista = perdas.filter((p) => inWindow(p.data));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>% de perdas por unidade</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova perda</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar perda / quebra</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Loja</Label>
                  <Select value={form.loja_id} onValueChange={(v) => setForm({ ...form, loja_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.codigo} — {l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOTIVOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria (opcional)</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Hortifruti, Açougue…" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Unidade</th>
                <th className="px-4 py-3 text-right">Faturamento</th>
                <th className="px-4 py-3 text-right">Perdas</th>
                <th className="px-4 py-3 text-right">% sobre venda</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3"><span className="font-medium">{r.codigo}</span> <span className="text-muted-foreground">{r.nome}</span></td>
                  <td className="px-4 py-3 text-right">{fmtBRL(r.faturamento)}</td>
                  <td className="px-4 py-3 text-right">{fmtBRL(r.perdas)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.faturamento > 0 ? pctFmt(r.perdasPct) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lançamentos do período</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {lista.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma perda lançada no período.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Loja</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">{p.lojas?.codigo ?? "—"} {p.lojas?.nome ?? ""}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{MOTIVOS[p.motivo] ?? p.motivo}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtBRL(Number(p.valor))}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => excluir.mutate(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
