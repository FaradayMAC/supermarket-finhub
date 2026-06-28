import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comparativo")({
  head: () => ({ meta: [{ title: "Comparativo entre unidades · MercadoGest" }] }),
  component: Comparativo,
});

function Comparativo() {
  const [periodo, setPeriodo] = useState<"1m" | "3m" | "6m" | "12m" | "all">("6m");

  const { data, isLoading } = useQuery({
    queryKey: ["comparativo"],
    queryFn: async () => {
      const [lojas, despesas, funcionarios, impostos, folha, mov] = await Promise.all([
        supabase.from("lojas").select("id, nome, codigo, ativo"),
        supabase.from("despesas").select("loja_id, valor, data_competencia"),
        supabase.from("funcionarios").select("loja_id, salario_base, encargos, beneficios, ativo"),
        supabase.from("impostos").select("loja_id, valor, competencia"),
        supabase.from("folha_pagamento").select("funcionario_id, custo_total, competencia"),
        supabase.from("movimentacoes_financeiras").select("loja_id, tipo, valor, data_movimentacao"),
      ]);
      return {
        lojas: lojas.data ?? [],
        despesas: (despesas.data ?? []) as any[],
        funcionarios: (funcionarios.data ?? []) as any[],
        impostos: (impostos.data ?? []) as any[],
        folha: (folha.data ?? []) as any[],
        mov: (mov.data ?? []) as any[],
      };
    },
  });

  const monthsBack = periodo === "1m" ? 1 : periodo === "3m" ? 3 : periodo === "6m" ? 6 : periodo === "12m" ? 12 : null;
  const cutoff = useMemo(() => {
    if (!monthsBack) return null;
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (monthsBack - 1));
    return d.toISOString().slice(0, 10);
  }, [monthsBack]);
  const inWindow = (iso?: string | null) => !!iso && (!cutoff || iso >= cutoff);
  const meses = monthsBack ?? 12;

  const lojas = data?.lojas ?? [];
  const porLoja = lojas.map((l: any) => {
    const desp = (data?.despesas ?? []).filter((d) => d.loja_id === l.id && inWindow(d.data_competencia)).reduce((s, d) => s + Number(d.valor), 0);
    const imp = (data?.impostos ?? []).filter((i) => i.loja_id === l.id && inWindow(i.competencia)).reduce((s, i) => s + Number(i.valor), 0);
    const funcsLoja = (data?.funcionarios ?? []).filter((f) => f.loja_id === l.id && f.ativo);
    const custoMensalFuncs = funcsLoja.reduce((s, f) => s + Number(f.salario_base ?? 0) + Number(f.encargos ?? 0) + Number(f.beneficios ?? 0), 0);
    const folhaLanc = (data?.folha ?? []).filter((f) => {
      const fn = (data?.funcionarios ?? []).find((x) => x.loja_id === l.id);
      return fn && inWindow(f.competencia);
    });
    const folhaTotal = folhaLanc.length > 0
      ? folhaLanc.reduce((s, f) => s + Number(f.custo_total ?? 0), 0)
      : custoMensalFuncs * meses;
    const receita = (data?.mov ?? []).filter((m) => m.loja_id === l.id && m.tipo === "entrada" && inWindow(m.data_movimentacao)).reduce((s, m) => s + Number(m.valor), 0);
    const custo = desp + imp + folhaTotal;
    const resultado = receita - custo;
    const nFuncs = funcsLoja.length;
    const custoPorFunc = nFuncs > 0 ? folhaTotal / nFuncs : 0;
    return {
      id: l.id, nome: l.nome, codigo: l.codigo,
      faturamento: receita, despesas: desp, folha: folhaTotal,
      impostos: imp, resultado, custoPorFunc, nFuncs,
    };
  });

  const totais = porLoja.reduce((acc, r) => ({
    faturamento: acc.faturamento + r.faturamento,
    despesas: acc.despesas + r.despesas,
    folha: acc.folha + r.folha,
    impostos: acc.impostos + r.impostos,
    resultado: acc.resultado + r.resultado,
  }), { faturamento: 0, despesas: 0, folha: 0, impostos: 0, resultado: 0 });

  return (
    <AppShell
      title="Comparativo entre unidades"
      actions={
        <div className="flex items-center gap-2">
          <Label className="hidden text-xs uppercase text-muted-foreground sm:inline">Período:</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Último mês</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : porLoja.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Cadastre lojas para comparar.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Faturamento × Custos × Resultado</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porLoja}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="codigo" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="faturamento" fill="var(--color-chart-2)" name="Faturamento" />
                  <Bar dataKey="despesas" fill="var(--color-chart-1)" name="Despesas" />
                  <Bar dataKey="folha" fill="var(--color-chart-3)" name="Folha" />
                  <Bar dataKey="impostos" fill="var(--color-chart-4)" name="Impostos" />
                  <Bar dataKey="resultado" fill="var(--color-chart-5)" name="Resultado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tabela comparativa</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Faturamento</th>
                    <th className="px-4 py-3 text-right">Despesas</th>
                    <th className="px-4 py-3 text-right">Folha</th>
                    <th className="px-4 py-3 text-right">Impostos</th>
                    <th className="px-4 py-3 text-right">Resultado</th>
                    <th className="px-4 py-3 text-right">Custo / funcionário</th>
                  </tr>
                </thead>
                <tbody>
                  {porLoja.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">{r.codigo} · {r.nFuncs} func.</div>
                      </td>
                      <td className="px-4 py-3 text-right">{fmtBRL(r.faturamento)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.despesas)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.folha)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(r.impostos)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${r.resultado >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(r.resultado)}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(r.custoPorFunc)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.faturamento)}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.despesas)}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.folha)}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(totais.impostos)}</td>
                    <td className={`px-4 py-3 text-right ${totais.resultado >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(totais.resultado)}</td>
                    <td className="px-4 py-3 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
