import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { ArrowDownRight, Building2, Users, Receipt, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · MercadoGest" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [lojas, despesas, funcionarios] = await Promise.all([
        supabase.from("lojas").select("id, nome, codigo, ativo"),
        supabase.from("despesas").select("id, loja_id, valor, data_competencia, categoria_id, categorias_despesa(nome)"),
        supabase.from("funcionarios").select("id, loja_id, salario_base, encargos, beneficios, ativo"),
      ]);
      return {
        lojas: lojas.data ?? [],
        despesas: (despesas.data as any[]) ?? [],
        funcionarios: funcionarios.data ?? [],
      };
    },
  });

  const lojas = data?.lojas ?? [];
  const despesas = data?.despesas ?? [];
  const funcionarios = data?.funcionarios ?? [];

  const totalDespesas = despesas.reduce((s, d: any) => s + Number(d.valor), 0);
  const totalFolha = funcionarios.reduce(
    (s, f: any) => s + Number(f.salario_base) + Number(f.encargos) + Number(f.beneficios),
    0,
  );
  const custoTotal = totalDespesas + totalFolha;

  const porLoja = lojas.map((l: any) => {
    const desp = despesas.filter((d: any) => d.loja_id === l.id).reduce((s, d: any) => s + Number(d.valor), 0);
    const folha = funcionarios
      .filter((f: any) => f.loja_id === l.id)
      .reduce((s, f: any) => s + Number(f.salario_base) + Number(f.encargos) + Number(f.beneficios), 0);
    return { nome: l.nome, codigo: l.codigo, despesas: desp, folha, total: desp + folha };
  });

  const porCategoria: Record<string, number> = {};
  despesas.forEach((d: any) => {
    const k = d.categorias_despesa?.nome ?? "Sem categoria";
    porCategoria[k] = (porCategoria[k] ?? 0) + Number(d.valor);
  });
  const catData = Object.entries(porCategoria).map(([name, value]) => ({ name, value }));

  const chartColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  return (
    <AppShell title="Dashboard">
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<Building2 className="h-4 w-4" />} label="Lojas ativas" value={String(lojas.filter((l: any) => l.ativo).length)} />
            <Kpi icon={<Users className="h-4 w-4" />} label="Funcionários" value={String(funcionarios.filter((f: any) => f.ativo).length)} />
            <Kpi icon={<Receipt className="h-4 w-4" />} label="Despesas (total)" value={fmtBRL(totalDespesas)} accent="warning" />
            <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Custo total" value={fmtBRL(custoTotal)} accent="destructive" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Custo por loja</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {porLoja.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porLoja}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="codigo" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: number) => fmtBRL(v)}
                        contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar dataKey="despesas" stackId="a" fill="var(--color-chart-1)" name="Despesas" />
                      <Bar dataKey="folha" stackId="a" fill="var(--color-chart-2)" name="Folha" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
              <CardContent className="h-72">
                {catData.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {catData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Resultado consolidado por loja</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Loja</th>
                    <th className="px-4 py-3 text-right">Despesas</th>
                    <th className="px-4 py-3 text-right">Folha</th>
                    <th className="px-4 py-3 text-right">Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {porLoja.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Cadastre lojas e lançamentos para ver o consolidado.</td></tr>
                  )}
                  {porLoja.map((r) => (
                    <tr key={r.codigo} className="border-b last:border-0">
                      <td className="px-4 py-3"><span className="font-medium">{r.nome}</span> <span className="text-muted-foreground">· {r.codigo}</span></td>
                      <td className="px-4 py-3 text-right">{fmtBRL(r.despesas)}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(r.folha)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtBRL(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "warning" | "destructive" }) {
  const color = accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : "text-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={color}>{icon}</span>{label}
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <ArrowDownRight className="mr-2 h-4 w-4" /> Sem dados ainda
    </div>
  );
}
