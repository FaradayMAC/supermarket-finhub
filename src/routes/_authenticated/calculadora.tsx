import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/calculadora")({
  head: () => ({ meta: [{ title: "Calculadora de Custo · MercadoGest" }] }),
  component: CalcPage,
});

// Alíquotas patronais sobre a folha
const INSS_PATRONAL = 0.20; // 20%
const FGTS = 0.08; // 8%
const RAT_TERCEIROS = 0.085; // ~8,5% (RAT 1-3% + Sistema S ~5,8%)
const FERIAS_FATOR = (1 / 12) * (1 + 1 / 3);
const DECIMO_FATOR = 1 / 12;

type Regime = "simples" | "lucro_real";

type Fields = {
  salario: number;
  vt: number;
  va: number;
  ps: number;
  outros: number;
  salarioFamilia: number;
  regime: Regime;
};

const ZERO: Fields = {
  salario: 0,
  vt: 0,
  va: 0,
  ps: 0,
  outros: 0,
  salarioFamilia: 0,
  regime: "simples",
};

function calcular(f: Fields) {
  // No Simples Nacional, INSS Patronal (20%) e RAT/Terceiros (~8,5%) são
  // recolhidos via DAS — não incidem na folha. FGTS continua devido.
  const isLucroReal = f.regime === "lucro_real";
  const inss = isLucroReal ? f.salario * INSS_PATRONAL : 0;
  const ratTerc = isLucroReal ? f.salario * RAT_TERCEIROS : 0;
  const fgts = f.salario * FGTS;
  const ferias = f.salario * FERIAS_FATOR;
  const decimo = f.salario * DECIMO_FATOR;
  // Encargos sobre férias e 13º: INSS patronal (se Lucro Real) + FGTS sempre.
  const rateProv = (isLucroReal ? INSS_PATRONAL : 0) + FGTS;
  const encSobreProvisoes = (ferias + decimo) * rateProv;
  const beneficios = f.vt + f.va + f.ps + f.outros;
  const mensal =
    f.salario +
    inss +
    fgts +
    ratTerc +
    ferias +
    decimo +
    encSobreProvisoes +
    beneficios +
    f.salarioFamilia;
  return {
    inss,
    fgts,
    ratTerc,
    ferias,
    decimo,
    encSobreProvisoes,
    beneficios,
    salarioFamilia: f.salarioFamilia,
    mensal,
    anual: mensal * 12,
    isLucroReal,
  };
}

function CalcPage() {
  const [f, setF] = useState<Fields>({ ...ZERO, salario: 2000 });
  const r = calcular(f);

  const { data: funcs = [] } = useQuery({
    queryKey: ["funcionarios-calc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "loja_id, salario_base, vale_transporte, vale_alimentacao, plano_saude, salario_familia, regime_tributario, lojas(nome, codigo)",
        )
        .eq("ativo", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const porUnidade = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; codigo: string; mensal: number; anual: number; qtd: number }
    >();
    for (const x of funcs) {
      const c = calcular({
        salario: Number(x.salario_base) || 0,
        vt: Number(x.vale_transporte) || 0,
        va: Number(x.vale_alimentacao) || 0,
        ps: Number(x.plano_saude) || 0,
        outros: 0,
        salarioFamilia: Number(x.salario_familia) || 0,
        regime: (x.regime_tributario as Regime) ?? "simples",
      });
      const key = x.loja_id;
      const prev = map.get(key) ?? {
        nome: x.lojas?.nome ?? "—",
        codigo: x.lojas?.codigo ?? "",
        mensal: 0,
        anual: 0,
        qtd: 0,
      };
      prev.mensal += c.mensal;
      prev.anual += c.mensal * 12;
      prev.qtd += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.mensal - a.mensal);
  }, [funcs]);

  const totalGeralMensal = porUnidade.reduce((s, u) => s + u.mensal, 0);

  const setNum = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: Number(e.target.value) || 0 }));

  return (
    <AppShell title="Calculadora de Custo Real">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Simulação individual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Regime tributário da empresa</Label>
              <Select
                value={f.regime}
                onValueChange={(v) => setF((p) => ({ ...p, regime: v as Regime }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples Nacional (folha desonerada)</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real / Presumido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário base (R$)</Label>
              <Input type="number" min="0" step="0.01" value={f.salario} onChange={setNum("salario")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vale transporte</Label>
                <Input type="number" min="0" step="0.01" value={f.vt} onChange={setNum("vt")} />
              </div>
              <div>
                <Label>Vale alimentação</Label>
                <Input type="number" min="0" step="0.01" value={f.va} onChange={setNum("va")} />
              </div>
              <div>
                <Label>Plano de saúde</Label>
                <Input type="number" min="0" step="0.01" value={f.ps} onChange={setNum("ps")} />
              </div>
              <div>
                <Label>Outros benefícios</Label>
                <Input type="number" min="0" step="0.01" value={f.outros} onChange={setNum("outros")} />
              </div>
              <div className="col-span-2">
                <Label>Salário-família (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.salarioFamilia}
                  onChange={setNum("salarioFamilia")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Resultado{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {r.isLucroReal ? "Lucro Real" : "Simples Nacional"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              <Row label="Salário" value={f.salario} />
              <Row
                label={r.isLucroReal ? "INSS Patronal (20%)" : "INSS Patronal (no DAS)"}
                value={r.inss}
              />
              <Row label="FGTS (8%)" value={r.fgts} />
              <Row
                label={r.isLucroReal ? "RAT + Sistema S (~8,5%)" : "RAT + Sistema S (no DAS)"}
                value={r.ratTerc}
              />
              <Row label="Férias + 1/3 (provisão mensal)" value={r.ferias} />
              <Row label="13º salário (provisão mensal)" value={r.decimo} />
              <Row label="Encargos s/ férias e 13º" value={r.encSobreProvisoes} />
              <Row label="Vale transporte" value={f.vt} />
              <Row label="Vale alimentação" value={f.va} />
              <Row label="Plano de saúde" value={f.ps} />
              <Row label="Outros benefícios" value={f.outros} />
              <Row label="Salário-família" value={r.salarioFamilia} />
              <div className="my-2 border-t" />
              <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                <span className="font-semibold">Custo mensal</span>
                <span className="text-lg font-bold text-primary">{fmtBRL(r.mensal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="font-semibold">Custo anual</span>
                <span className="text-lg font-bold">{fmtBRL(r.anual)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Custo total por unidade</CardTitle>
          <div className="text-sm text-muted-foreground">
            Total geral mensal:{" "}
            <span className="font-semibold text-foreground">{fmtBRL(totalGeralMensal)}</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-center">Funcionários</th>
                <th className="px-4 py-3 text-right">Custo mensal</th>
                <th className="px-4 py-3 text-right">Custo anual</th>
              </tr>
            </thead>
            <tbody>
              {porUnidade.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Cadastre funcionários para ver o custo por unidade.
                  </td>
                </tr>
              )}
              {porUnidade.map((u) => (
                <tr key={u.codigo + u.nome} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {u.nome} <span className="text-muted-foreground">({u.codigo})</span>
                  </td>
                  <td className="px-4 py-3 text-center">{u.qtd}</td>
                  <td className="px-4 py-3 text-right">{fmtBRL(u.mensal)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtBRL(u.anual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{fmtBRL(value)}</span>
    </div>
  );
}
