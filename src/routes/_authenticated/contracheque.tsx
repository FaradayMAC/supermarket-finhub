import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { calcContracheque, calendarioMes, type FaltaDia, type FuncionarioCC } from "@/lib/contracheque";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { gerarContrachequePdf } from "@/lib/contracheque-pdf";

export const Route = createFileRoute("/_authenticated/contracheque")({
  head: () => ({
    meta: [
      { title: "Contra cheque · MercadoGest" },
      { name: "description", content: "Resumo mensal do que cada funcionário tem a receber, com faltas, DSR e convênio." },
      { property: "og:title", content: "Contra cheque · MercadoGest" },
      { property: "og:description", content: "Contracheque mensal por funcionário com descontos de faltas, DSR e convênio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContrachequePage,
});

type Func = FuncionarioCC & {
  id: string;
  nome: string;
  cargo: string | null;
  loja_id: string;
};

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function ContrachequePage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [lojaFiltro, setLojaFiltro] = useState<string>("todas");
  const [detalhe, setDetalhe] = useState<Func | null>(null);
  const [convOpen, setConvOpen] = useState<Func | null>(null);
  const { salarioMinimoFederal } = useReferenciasSalariais();

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id,nome,codigo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; codigo: string }[];
    },
  });

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios-contracheque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id,nome,cargo,loja_id,salario_base,vale_transporte,vale_alimentacao,plano_saude,plano_odontologico,salario_familia,valor_extra_salarial,cargo_id,motivo_insalubridade,tem_periculosidade,periculosidade_pct,tem_quebra_caixa,dependentes,desconto_vt,cargos(motivo_insalubridade,tem_periculosidade,periculosidade_pct,tem_quebra_caixa),lojas(empresa_id,empresas(regime_tributario))",
        )
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as unknown as Func[];
    },
  });

  const { data: faltas = [] } = useQuery({
    queryKey: ["faltas-mes", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_rh")
        .select("funcionario_id,data,tipo")
        .gte("data", `${mes}-01`)
        .lte("data", `${mes}-31`);
      if (error) throw error;
      return data as { funcionario_id: string; data: string; tipo: string }[];
    },
  });

  const { data: convenios = [] } = useQuery({
    queryKey: ["convenio-mes", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenio_funcionario")
        .select("id,funcionario_id,valor,observacoes")
        .eq("mes_referencia", `${mes}-01`);
      if (error) throw error;
      return data as { id: string; funcionario_id: string; valor: number; observacoes: string | null }[];
    },
  });

  const faltasMap = useMemo(() => {
    const m = new Map<string, FaltaDia[]>();
    faltas.forEach((f) => {
      const arr = m.get(f.funcionario_id) ?? [];
      arr.push({ data: f.data, tipo: f.tipo });
      m.set(f.funcionario_id, arr);
    });
    return m;
  }, [faltas]);

  const convMap = useMemo(
    () => new Map(convenios.map((c) => [c.funcionario_id, c])),
    [convenios],
  );
  const lojaMap = useMemo(() => new Map(lojas.map((l) => [l.id, l])), [lojas]);

  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => lojaFiltro === "todas" || f.loja_id === lojaFiltro)
      .map((f) => ({
        f,
        cc: calcContracheque(f, {
          mes,
          faltas: faltasMap.get(f.id) ?? [],
          convenio: Number(convMap.get(f.id)?.valor ?? 0),
          salarioMinimoFederal,
        }),
      }));
  }, [funcionarios, lojaFiltro, mes, faltasMap, convMap, salarioMinimoFederal]);

  const totalLiquido = lista.reduce((s, i) => s + i.cc.liquido, 0);
  const totalDescontos = lista.reduce((s, i) => s + i.cc.totalDescontos, 0);
  const totalConvenio = lista.reduce((s, i) => s + i.cc.convenio, 0);
  const cal = calendarioMes(mes);

  const baixarPdf = async (f: Func) => {
    try {
      await gerarContrachequePdf({
        func: f,
        loja: lojaMap.get(f.loja_id)?.nome ?? "—",
        mes,
        faltas: faltasMap.get(f.id) ?? [],
        convenio: Number(convMap.get(f.id)?.valor ?? 0),
        salarioMinimoFederal,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    }
  };

  const saveConvenio = useMutation({
    mutationFn: async (v: { funcionario: Func; valor: number; observacoes: string }) => {
      const payload = {
        funcionario_id: v.funcionario.id,
        loja_id: v.funcionario.loja_id,
        mes_referencia: `${mes}-01`,
        valor: v.valor,
        observacoes: v.observacoes || null,
      };
      const { error } = await supabase
        .from("convenio_funcionario")
        .upsert(payload, { onConflict: "funcionario_id,mes_referencia" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convênio atualizado");
      qc.invalidateQueries({ queryKey: ["convenio-mes", mes] });
      setConvOpen(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <AppShell
      title="Contra cheque"
      actions={
        <div className="flex items-center gap-2">
          <Input type="month" className="w-[10rem]" value={mes} onChange={(e) => setMes(e.target.value)} />
          <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {lojas.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Líquido a pagar</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtBRL(totalLiquido)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total de descontos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtBRL(totalDescontos)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Convênio (loja)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtBRL(totalConvenio)}</CardContent></Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Calendário ES</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {cal.diasUteis} dias úteis · {cal.diasRepouso} de repouso (DSR)
            {cal.feriados.length > 0 && (
              <div className="mt-1 text-xs">{cal.feriados.map((f) => `${String(f.dia).padStart(2, "0")} ${f.nome}`).join(" · ")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3 text-center">Faltas</th>
                <th className="px-4 py-3 text-right">Proventos</th>
                <th className="px-4 py-3 text-right">Faltas + DSR</th>
                <th className="px-4 py-3 text-right">Convênio</th>
                <th className="px-4 py-3 text-right">Descontos</th>
                <th className="px-4 py-3 text-right">Líquido</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && lista.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nenhum funcionário ativo para este filtro.</td></tr>
              )}
              {lista.map(({ f, cc }) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.nome}</div>
                    <div className="text-xs text-muted-foreground">{f.cargo ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">{lojaMap.get(f.loja_id)?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {cc.faltas > 0 ? <Badge variant="destructive">{cc.faltas}</Badge> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{fmtBRL(cc.proventos)}</td>
                  <td className="px-4 py-3 text-right text-destructive">{cc.descFaltas + cc.descDsr > 0 ? `- ${fmtBRL(cc.descFaltas + cc.descDsr)}` : "—"}</td>
                  <td className="px-4 py-3 text-right text-destructive">{cc.convenio > 0 ? `- ${fmtBRL(cc.convenio)}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{fmtBRL(cc.totalDescontos)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtBRL(cc.liquido)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" title="Lançar convênio" onClick={() => setConvOpen(f)}>
                      <ShoppingBasket className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Ver contracheque" onClick={() => setDetalhe(f)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Baixar contracheque em PDF" onClick={() => baixarPdf(f)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          {detalhe && (
            <DetalheContracheque
              func={detalhe}
              loja={lojaMap.get(detalhe.loja_id)?.nome ?? "—"}
              mes={mes}
              faltas={faltasMap.get(detalhe.id) ?? []}
              convenio={Number(convMap.get(detalhe.id)?.valor ?? 0)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!convOpen} onOpenChange={(o) => !o && setConvOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convênio da loja — {convOpen?.nome}</DialogTitle></DialogHeader>
          {convOpen && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                saveConvenio.mutate({
                  funcionario: convOpen,
                  valor: Number(fd.get("valor") || 0),
                  observacoes: String(fd.get("obs") || ""),
                });
              }}
            >
              <div>
                <Label>Valor gasto no convênio (R$) *</Label>
                <Input name="valor" type="number" step="0.01" min={0} defaultValue={Number(convMap.get(convOpen.id)?.valor ?? 0)} required />
                <p className="mt-1 text-xs text-muted-foreground">Compras feitas na loja no mês de referência — descontado do líquido.</p>
              </div>
              <div>
                <Label>Observações</Label>
                <Input name="obs" defaultValue={convMap.get(convOpen.id)?.observacoes ?? ""} placeholder="Opcional" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saveConvenio.isPending}>{saveConvenio.isPending ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Linha({ label, valor, negativo, muted }: { label: string; valor: number; negativo?: boolean; muted?: boolean }) {
  if (!valor) return null;
  return (
    <div className={`flex justify-between py-1 text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={negativo ? "text-destructive" : ""}>{negativo ? "- " : ""}{fmtBRL(Math.abs(valor))}</span>
    </div>
  );
}

function DetalheContracheque({
  func, loja, mes, faltas, convenio,
}: { func: Func; loja: string; mes: string; faltas: FaltaDia[]; convenio: number }) {
  const { salarioMinimoFederal } = useReferenciasSalariais();
  const cc = calcContracheque(func, { mes, faltas, convenio, salarioMinimoFederal });
  const [y, m] = mes.split("-");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{func.nome}</DialogTitle>
      </DialogHeader>
      <div className="text-xs text-muted-foreground">
        {func.cargo ?? "—"} · {loja} · Competência {m}/{y}
      </div>

      <div className="mt-2 rounded-md border p-3">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Proventos</div>
        <Linha label="Salário base" valor={cc.salario} />
        <Linha label="Insalubridade" valor={cc.insalubridade} />
        <Linha label="Periculosidade" valor={cc.periculosidade} />
        <Linha label="Quebra de caixa" valor={cc.quebraCaixa} />
        <Linha label="Valor extra salarial" valor={cc.extra} />
        <Linha label="Salário-família" valor={cc.salFamilia} />
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold">
          <span>Total de proventos</span><span>{fmtBRL(cc.proventos)}</span>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Descontos</div>
        <Linha label={`Faltas injustificadas (${cc.faltas} dia(s))`} valor={cc.descFaltas} negativo />
        <Linha label={`DSR perdido (${cc.dsrDias} semana(s))`} valor={cc.descDsr} negativo />
        <Linha label="Redução proporcional do valor extra" valor={cc.descExtra} negativo />
        <Linha label="INSS" valor={cc.inss} negativo />
        <Linha label="IRRF" valor={cc.irrf} negativo />
        <Linha label="Vale-transporte (6%)" valor={cc.descontoVt} negativo />
        <Linha label="Plano de saúde" valor={cc.planoSaude} negativo />
        <Linha label="Plano odontológico" valor={cc.planoOdonto} negativo />
        <Linha label="Convênio (compras na loja)" valor={cc.convenio} negativo />
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold">
          <span>Total de descontos</span><span className="text-destructive">- {fmtBRL(cc.totalDescontos)}</span>
        </div>
      </div>

      {(cc.va > 0 || cc.vt > 0) && (
        <div className="rounded-md border p-3">
          <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Benefícios (proporcionais às faltas)</div>
          <Linha label="Vale-alimentação" valor={cc.vaLiquido} muted />
          <Linha label="Redução por faltas (VA)" valor={cc.descVa} negativo muted />
          <Linha label="Vale-transporte" valor={cc.vtLiquido} muted />
          <Linha label="Redução por faltas (VT)" valor={cc.descVtBeneficio} negativo muted />
        </div>
      )}

      <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-3">
        <span className="text-sm font-semibold">Líquido a receber</span>
        <span className="text-xl font-bold">{fmtBRL(cc.liquido)}</span>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
          Encargos da empresa (não descontados do funcionário)
        </div>
        <Linha label="FGTS do mês (8%)" valor={cc.fgts} muted />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Base: {fmtBRL(cc.baseFgts)} — remuneração do mês já ajustada por faltas injustificadas e DSR perdido.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={() => gerarContrachequePdf({ func, loja, mes, faltas, convenio })}
      >
        <Download className="mr-2 h-4 w-4" /> Baixar PDF
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Cálculo conforme CLT e Lei 605/49, com feriados nacionais e estaduais do Espírito Santo
        ({cc.calendario.diasUteis} dias úteis / {cc.calendario.diasRepouso} dias de repouso no mês).
      </p>
    </>
  );
}
