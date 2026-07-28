import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodFilter, usePeriodo } from "@/components/period-filter";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({ meta: [{ title: "DRE Gerencial · MercadoGest" }] }),
  component: DREPage,
});

const isCMV = (nome?: string | null) => {
  if (!nome) return false;
  const n = nome.toLowerCase();
  return n.includes("cmv") || n.includes("mercadoria") || n.includes("revenda") || n.includes("custo da venda") || n.includes("custo de venda");
};

function DREPage() {
  const periodoState = usePeriodo("1m");

  const { data, isLoading } = useQuery({
    queryKey: ["dre"],
    queryFn: async () => {
      const [lojas, despesas, funcionarios, impostos, folha, mov, cats] = await Promise.all([
        supabase.from("lojas").select("id, nome, codigo, ativo"),
        supabase.from("despesas").select("loja_id, categoria_id, valor, data_competencia"),
        supabase.from("funcionarios").select("loja_id, salario_base, encargos, beneficios, ativo"),
        supabase.from("impostos").select("loja_id, valor, competencia"),
        supabase.from("folha_pagamento").select("funcionario_id, custo_total, competencia"),
        supabase.from("movimentacoes_financeiras").select("loja_id, tipo, valor, data_movimentacao"),
        supabase.from("categorias_despesa").select("id, nome"),
      ]);
      return {
        lojas: lojas.data ?? [],
        despesas: (despesas.data ?? []) as any[],
        funcionarios: (funcionarios.data ?? []) as any[],
        impostos: (impostos.data ?? []) as any[],
        folha: (folha.data ?? []) as any[],
        mov: (mov.data ?? []) as any[],
        cats: (cats.data ?? []) as any[],
      };
    },
  });

  const { inWindow, meses } = periodoState;

  const cmvCatIds = useMemo(() => {
    const ids = new Set<string>();
    (data?.cats ?? []).forEach((c) => { if (isCMV(c.nome)) ids.add(c.id); });
    return ids;
  }, [data?.cats]);

  const linhas = (data?.lojas ?? []).map((l: any) => {
    const despLoja = (data?.despesas ?? []).filter((d) => d.loja_id === l.id && inWindow(d.data_competencia));
    const cmv = despLoja.filter((d) => d.categoria_id && cmvCatIds.has(d.categoria_id)).reduce((s, d) => s + Number(d.valor), 0);
    const despOp = despLoja.filter((d) => !d.categoria_id || !cmvCatIds.has(d.categoria_id)).reduce((s, d) => s + Number(d.valor), 0);
    const imp = (data?.impostos ?? []).filter((i) => i.loja_id === l.id && inWindow(i.competencia)).reduce((s, i) => s + Number(i.valor), 0);
    const funcsLoja = (data?.funcionarios ?? []).filter((f) => f.loja_id === l.id && f.ativo);
    const funcIds = new Set(funcsLoja.map((f: any) => f.id));
    const custoMensalFuncs = funcsLoja.reduce((s, f) => s + Number(f.salario_base ?? 0) + Number(f.encargos ?? 0) + Number(f.beneficios ?? 0), 0);
    const folhaLanc = (data?.folha ?? []).filter((f) => funcIds.has(f.funcionario_id) && inWindow(f.competencia));
    const folhaTotal = folhaLanc.length > 0
      ? folhaLanc.reduce((s, f) => s + Number(f.custo_total ?? 0), 0)
      : custoMensalFuncs * meses;
    const faturamento = (data?.mov ?? []).filter((m) => m.loja_id === l.id && m.tipo === "entrada" && inWindow(m.data_movimentacao)).reduce((s, m) => s + Number(m.valor), 0);

    const receitaLiquida = faturamento - imp;
    const lucroBruto = receitaLiquida - cmv;
    const ebitda = lucroBruto - folhaTotal - despOp;
    const resultadoLiquido = ebitda; // sem depreciação/financeiro modelados
    const margemEbitda = faturamento > 0 ? (ebitda / faturamento) * 100 : 0;
    const margemLiquida = faturamento > 0 ? (resultadoLiquido / faturamento) * 100 : 0;

    return {
      id: l.id, nome: l.nome, codigo: l.codigo,
      faturamento, impostos: imp, receitaLiquida, cmv, lucroBruto,
      folha: folhaTotal, despOp, ebitda, resultadoLiquido,
      margemEbitda, margemLiquida,
    };
  });

  const totais = linhas.reduce((a, r) => ({
    faturamento: a.faturamento + r.faturamento,
    impostos: a.impostos + r.impostos,
    receitaLiquida: a.receitaLiquida + r.receitaLiquida,
    cmv: a.cmv + r.cmv,
    lucroBruto: a.lucroBruto + r.lucroBruto,
    folha: a.folha + r.folha,
    despOp: a.despOp + r.despOp,
    ebitda: a.ebitda + r.ebitda,
    resultadoLiquido: a.resultadoLiquido + r.resultadoLiquido,
  }), { faturamento: 0, impostos: 0, receitaLiquida: 0, cmv: 0, lucroBruto: 0, folha: 0, despOp: 0, ebitda: 0, resultadoLiquido: 0 });

  const margemEbitdaT = totais.faturamento > 0 ? (totais.ebitda / totais.faturamento) * 100 : 0;
  const margemLiqT = totais.faturamento > 0 ? (totais.resultadoLiquido / totais.faturamento) * 100 : 0;

  const pct = (v: number, base: number) => base > 0 ? `${((v / base) * 100).toFixed(1)}%` : "—";

  return (
    <AppShell
      title="DRE Gerencial por unidade"
      actions={<PeriodFilter state={periodoState} />}
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : linhas.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Cadastre lojas para gerar o DRE.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-primary" />
              Demonstrativo de Resultados — comparativo por unidade
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left">Linha</th>
                  {linhas.map((r) => (
                    <th key={r.id} className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-foreground">{r.codigo}</div>
                      <div className="text-[10px] text-muted-foreground normal-case">{r.nome}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right bg-primary/5">Total</th>
                </tr>
              </thead>
              <tbody>
                <RowLine label="(+) Faturamento" values={linhas.map(r => r.faturamento)} total={totais.faturamento} strong />
                <RowLine label="(−) Impostos" values={linhas.map(r => -r.impostos)} total={-totais.impostos} muted
                  hints={linhas.map(r => pct(r.impostos, r.faturamento))} totalHint={pct(totais.impostos, totais.faturamento)} />
                <RowLine label="(=) Receita líquida" values={linhas.map(r => r.receitaLiquida)} total={totais.receitaLiquida} subtotal />
                <RowLine label="(−) CMV" values={linhas.map(r => -r.cmv)} total={-totais.cmv} muted
                  hints={linhas.map(r => pct(r.cmv, r.faturamento))} totalHint={pct(totais.cmv, totais.faturamento)} />
                <RowLine label="(=) Lucro bruto" values={linhas.map(r => r.lucroBruto)} total={totais.lucroBruto} subtotal />
                <RowLine label="(−) Folha" values={linhas.map(r => -r.folha)} total={-totais.folha} muted
                  hints={linhas.map(r => pct(r.folha, r.faturamento))} totalHint={pct(totais.folha, totais.faturamento)} />
                <RowLine label="(−) Despesas operacionais" values={linhas.map(r => -r.despOp)} total={-totais.despOp} muted
                  hints={linhas.map(r => pct(r.despOp, r.faturamento))} totalHint={pct(totais.despOp, totais.faturamento)} />
                <RowLine label="(=) EBITDA" values={linhas.map(r => r.ebitda)} total={totais.ebitda} strong
                  hints={linhas.map(r => `${r.margemEbitda.toFixed(1)}%`)} totalHint={`${margemEbitdaT.toFixed(1)}%`} />
                <RowLine label="(=) Resultado líquido" values={linhas.map(r => r.resultadoLiquido)} total={totais.resultadoLiquido} strong highlight
                  hints={linhas.map(r => `${r.margemLiquida.toFixed(1)}%`)} totalHint={`${margemLiqT.toFixed(1)}%`} />
              </tbody>
            </table>
            <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              CMV = despesas em categorias com "CMV/Mercadoria/Revenda". Despesas operacionais = demais categorias. Faturamento = entradas em movimentações financeiras. Folha usa lançamentos de folha quando existem; caso contrário, o custo mensal dos funcionários ativos × meses do período.
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function RowLine({
  label, values, total, strong, subtotal, muted, highlight, hints, totalHint,
}: {
  label: string;
  values: number[];
  total: number;
  strong?: boolean;
  subtotal?: boolean;
  muted?: boolean;
  highlight?: boolean;
  hints?: string[];
  totalHint?: string;
}) {
  const baseRow = subtotal ? "bg-muted/30" : highlight ? "bg-primary/5" : "";
  const labelCls = strong || subtotal ? "font-semibold" : "";
  const cellCls = (v: number) =>
    `px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${strong || subtotal ? "font-semibold" : ""} ${
      muted ? "text-muted-foreground" : v < 0 ? "text-destructive" : v > 0 ? "text-foreground" : "text-muted-foreground"
    }`;
  const totalSign = total < 0 ? "text-destructive" : total > 0 ? "text-foreground" : "text-muted-foreground";

  return (
    <tr className={`border-b last:border-0 ${baseRow}`}>
      <td className={`sticky left-0 z-10 ${baseRow || "bg-background"} px-4 py-2.5 ${labelCls}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={cellCls(v)}>
          {fmtBRL(v)}
          {hints?.[i] && <div className="text-[10px] font-normal text-muted-foreground">{hints[i]}</div>}
        </td>
      ))}
      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap bg-primary/5 font-semibold ${totalSign}`}>
        {fmtBRL(total)}
        {totalHint && <div className="text-[10px] font-normal text-muted-foreground">{totalHint}</div>}
      </td>
    </tr>
  );
}
