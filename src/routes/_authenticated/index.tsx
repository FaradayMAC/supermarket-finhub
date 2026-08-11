import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CUSTO_SELECT, custoReal } from "@/lib/custo-funcionario";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodFilter, usePeriodo } from "@/components/period-filter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  Receipt, Wallet, Landmark, Users, TrendingUp, TrendingDown,
  Trophy, ArrowDownRight, ShoppingBasket,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard Executivo · MercadoGest" }] }),
  component: Dashboard,
});

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

function Dashboard() {
  const periodoState = usePeriodo("1m");

  const { salarioMinimoFederal, planos: planosCfg } = useReferenciasSalariais();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [lojas, despesas, funcionarios, impostos, folha, mov, compras] = await Promise.all([
        supabase.from("lojas").select("id, nome, codigo, ativo"),
        supabase.from("despesas").select("id, loja_id, valor, data_competencia"),
        supabase.from("funcionarios").select(CUSTO_SELECT),
        supabase.from("impostos").select("id, loja_id, valor, competencia"),
        supabase.from("folha_pagamento").select("id, funcionario_id, custo_total, competencia"),
        supabase.from("movimentacoes_financeiras").select("loja_id, tipo, valor, data_movimentacao"),
        supabase.from("compras_mercadoria").select("id, loja_id, valor_total, data_compra"),
      ]);
      return {
        lojas: lojas.data ?? [],
        despesas: (despesas.data ?? []) as any[],
        funcionarios: (funcionarios.data ?? []) as any[],
        impostos: (impostos.data ?? []) as any[],
        folha: (folha.data ?? []) as any[],
        mov: (mov.data ?? []) as any[],
        compras: (compras.data ?? []) as any[],
      };
    },
  });

  const lojas = data?.lojas ?? [];
  const despesas = data?.despesas ?? [];
  const funcionarios = data?.funcionarios ?? [];
  const impostos = data?.impostos ?? [];
  const folhaLancada = data?.folha ?? [];
  const mov = data?.mov ?? [];
  const compras = data?.compras ?? [];


  // janela de período
  const { inWindow, meses: mesesJanela, monthsBack } = periodoState;


  // KPIs
  const totalDespesas = despesas.filter((d) => inWindow(d.data_competencia)).reduce((s, d) => s + Number(d.valor), 0);
  const totalImpostos = impostos.filter((i) => inWindow(i.competencia)).reduce((s, i) => s + Number(i.valor), 0);
  const totalCMV = compras.filter((c) => inWindow(c.data_compra)).reduce((s, c) => s + Number(c.valor_total), 0);

  // Folha: usa lançamentos de folha_pagamento no período; se vazio, cai pro cálculo mensal de funcionários ativos × meses
  const folhaPeriodo = folhaLancada.filter((f) => inWindow(f.competencia)).reduce((s, f) => s + Number(f.custo_total ?? 0), 0);
  const custoMensalFuncs = funcionarios
    .filter((f) => f.ativo)
    .reduce((s, f) => s + custoReal(f, salarioMinimoFederal, planosCfg).total, 0);
  
  const totalFolha = folhaPeriodo > 0 ? folhaPeriodo : custoMensalFuncs * mesesJanela;

  const receitas = mov
    .filter((m) => m.tipo === "entrada" && inWindow(m.data_movimentacao))
    .reduce((s, m) => s + Number(m.valor), 0);

  const custoOperacional = totalDespesas + totalImpostos + totalFolha + totalCMV;
  const resultado = receitas - custoOperacional;

  // Por loja (janela)
  const porLoja = lojas
    .map((l: any) => {
      const desp = despesas.filter((d) => d.loja_id === l.id && inWindow(d.data_competencia)).reduce((s, d) => s + Number(d.valor), 0);
      const cmv = compras.filter((c) => c.loja_id === l.id && inWindow(c.data_compra)).reduce((s, c) => s + Number(c.valor_total), 0);
      const imp = impostos.filter((i) => i.loja_id === l.id && inWindow(i.competencia)).reduce((s, i) => s + Number(i.valor), 0);
      const funcsLoja = funcionarios.filter((f) => f.loja_id === l.id && f.ativo);
      const folhaLoja = funcsLoja.reduce((s, f) => s + custoReal(f, salarioMinimoFederal, planosCfg).total, 0) * mesesJanela;
      const rec = mov.filter((m) => m.loja_id === l.id && m.tipo === "entrada" && inWindow(m.data_movimentacao)).reduce((s, m) => s + Number(m.valor), 0);
      const custo = desp + cmv + imp + folhaLoja;
      return {
        id: l.id,
        nome: l.nome,
        codigo: l.codigo,
        despesas: desp,
        cmv,
        impostos: imp,
        folha: folhaLoja,
        receita: rec,
        custo,
        resultado: rec - custo,
        funcionarios: funcsLoja.length,
      };
    })
    .filter((r) => r.custo > 0 || r.receita > 0);

  const ranking = [...porLoja].sort((a, b) => b.resultado - a.resultado);

  // Evolução mensal (últimos N meses dentro da janela; default 12 se "all")
  const evoMeses = monthsBack ?? 12;
  const monthly = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    const out: { key: string; label: string; despesas: number; cmv: number; impostos: number; folha: number; receita: number; resultado: number }[] = [];
    for (let i = evoMeses - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({ key, label: monthLabel(key), despesas: 0, cmv: 0, impostos: 0, folha: 0, receita: 0, resultado: 0 });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    despesas.forEach((d) => { const i = idx.get((d.data_competencia ?? "").slice(0, 7)); if (i != null) out[i].despesas += Number(d.valor); });
    compras.forEach((c) => { const i = idx.get((c.data_compra ?? "").slice(0, 7)); if (i != null) out[i].cmv += Number(c.valor_total); });
    impostos.forEach((i2) => { const i = idx.get((i2.competencia ?? "").slice(0, 7)); if (i != null) out[i].impostos += Number(i2.valor); });
    folhaLancada.forEach((f) => { const i = idx.get((f.competencia ?? "").slice(0, 7)); if (i != null) out[i].folha += Number(f.custo_total ?? 0); });
    mov.filter((m) => m.tipo === "entrada").forEach((m) => { const i = idx.get((m.data_movimentacao ?? "").slice(0, 7)); if (i != null) out[i].receita += Number(m.valor); });
    // Fallback de folha por mês (funcionários ativos) quando não há lançamentos no mês
    out.forEach((row) => {
      if (row.folha === 0) row.folha = custoMensalFuncs;
      row.resultado = row.receita - (row.despesas + row.cmv + row.impostos + row.folha);
    });
    return out;
  }, [despesas, compras, impostos, folhaLancada, mov, evoMeses, custoMensalFuncs]);


  return (
    <AppShell
      title="Dashboard executivo"
      actions={<PeriodFilter state={periodoState} />}
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-6">
          {/* KPIs principais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Kpi icon={<ShoppingBasket className="h-4 w-4" />} label="CMV (compras)" value={fmtBRL(totalCMV)} hint={`${compras.length} compra(s)`} accent="warning" />
            <Kpi icon={<Receipt className="h-4 w-4" />} label="Despesas" value={fmtBRL(totalDespesas)} hint={`${despesas.length} lançamento(s)`} accent="warning" />
            <Kpi icon={<Landmark className="h-4 w-4" />} label="Impostos" value={fmtBRL(totalImpostos)} hint={`${impostos.length} lançamento(s)`} accent="warning" />
            <Kpi icon={<Wallet className="h-4 w-4" />} label="Folha" value={fmtBRL(totalFolha)} hint={folhaPeriodo > 0 ? "lançamentos da folha" : `${mesesJanela}× custo mensal`} accent="warning" />
            <Kpi icon={<Users className="h-4 w-4" />} label="Custo de funcionários (mês)" value={fmtBRL(custoMensalFuncs)} hint={`${funcionarios.filter((f: any) => f.ativo).length} ativos`} />

            <Kpi
              icon={resultado >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label="Resultado operacional"
              value={fmtBRL(resultado)}
              hint={`Receitas ${fmtBRL(receitas)} − Custos ${fmtBRL(custoOperacional)}`}
              accent={resultado >= 0 ? "success" : "destructive"}
            />
          </div>

          {/* Evolução mensal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Evolução mensal</CardTitle></CardHeader>
            <CardContent className="h-80">
              {monthly.every((m) => m.despesas === 0 && m.impostos === 0 && m.receita === 0 && m.folha === 0) ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="receita" stroke="var(--color-chart-2)" strokeWidth={2} name="Receita" dot={false} />
                    <Line type="monotone" dataKey="despesas" stroke="var(--color-chart-1)" strokeWidth={2} name="Despesas" dot={false} />
                    <Line type="monotone" dataKey="cmv" stroke="var(--color-chart-6, var(--color-primary))" strokeWidth={2} name="CMV" dot={false} />
                    <Line type="monotone" dataKey="folha" stroke="var(--color-chart-3)" strokeWidth={2} name="Folha" dot={false} />

                    <Line type="monotone" dataKey="impostos" stroke="var(--color-chart-4)" strokeWidth={2} name="Impostos" dot={false} />
                    <Line type="monotone" dataKey="resultado" stroke="var(--color-chart-5)" strokeWidth={2} name="Resultado" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Comparativo entre unidades */}
          <Card>
            <CardHeader><CardTitle>Comparativo entre unidades</CardTitle></CardHeader>
            <CardContent className="h-80">
              {porLoja.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porLoja}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="codigo" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="cmv" stackId="c" fill="var(--color-chart-2)" name="CMV" />
                    <Bar dataKey="despesas" stackId="c" fill="var(--color-chart-1)" name="Despesas" />

                    <Bar dataKey="folha" stackId="c" fill="var(--color-chart-3)" name="Folha" />
                    <Bar dataKey="impostos" stackId="c" fill="var(--color-chart-4)" name="Impostos" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Ranking */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Ranking de unidades</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Receita</th>
                    <th className="px-4 py-3 text-right">CMV</th>
                    <th className="px-4 py-3 text-right">Despesas</th>
                    <th className="px-4 py-3 text-right">Folha</th>

                    <th className="px-4 py-3 text-right">Impostos</th>
                    <th className="px-4 py-3 text-right">Custo total</th>
                    <th className="px-4 py-3 text-right">Resultado</th>
                    <th className="px-4 py-3 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Cadastre lançamentos para ver o ranking.</td></tr>
                  )}

                  {ranking.map((r, i) => {
                    const margem = r.receita > 0 ? (r.resultado / r.receita) * 100 : null;
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-muted-foreground">{i + 1}º</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.nome}</div>
                          <div className="text-xs text-muted-foreground">{r.codigo} · {r.funcionarios} funcionário(s)</div>
                        </td>
                        <td className="px-4 py-3 text-right">{fmtBRL(r.receita)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.cmv)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.despesas)}</td>

                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.folha)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.impostos)}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmtBRL(r.custo)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${r.resultado >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(r.resultado)}</td>
                        <td className={`px-4 py-3 text-right ${margem !== null && margem >= 0 ? "text-success" : margem !== null ? "text-destructive" : "text-muted-foreground"}`}>
                          {margem !== null ? `${margem.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: "warning" | "destructive" | "success";
}) {
  const color =
    accent === "destructive" ? "text-destructive"
    : accent === "warning" ? "text-warning"
    : accent === "success" ? "text-success"
    : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={color}>{icon}</span>{label}
        </div>
        <div className={`mt-2 text-2xl font-bold tracking-tight ${accent === "success" || accent === "destructive" ? color : ""}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <ArrowDownRight className="mr-2 h-4 w-4" /> Sem dados no período
    </div>
  );
}
