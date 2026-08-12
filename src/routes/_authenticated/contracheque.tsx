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
import { CalendarDays, Download, FileText, Lock, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import {
  calcContracheque,
  calendarioMes,
  MAX_DIAS_VENDIDOS,
  type AfastamentoMes,
  type FaltaDia,
  type FeriasMes,
  type FuncionarioCC,
} from "@/lib/contracheque";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { gerarContrachequePdf } from "@/lib/contracheque-pdf";
import { competenciaDate, entraNaCompetencia, fmtDataHora, podeFechar } from "@/lib/folha-competencia";


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
  ativo?: boolean;
  data_admissao?: string | null;
  data_nascimento?: string | null;
  data_desligamento?: string | null;
};

type FolhaRow = {
  funcionario_id: string;
  loja_id: string | null;
  salario_base: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  fgts: number;
  status: string;
  fechada_em: string | null;
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
  const [eventoOpen, setEventoOpen] = useState<Func | null>(null);
  const { salarioMinimoFederal, planos: planosCfg } = useReferenciasSalariais();

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
          "id,nome,cargo,loja_id,ativo,data_admissao,data_desligamento,salario_base,vale_transporte,vale_alimentacao,data_nascimento,salario_familia,valor_extra_salarial,cargo_id,motivo_insalubridade,tem_periculosidade,periculosidade_pct,tem_quebra_caixa,dependentes,desconto_vt,cargos(motivo_insalubridade,tem_periculosidade,periculosidade_pct,tem_quebra_caixa),lojas(empresa_id,empresas(regime_tributario))",
        )
        .order("nome");
      if (error) throw error;
      return data as unknown as Func[];
    },
  });

  // Histórico oficial da competência (existe apenas quando a folha foi fechada)
  const { data: folha = [] } = useQuery({
    queryKey: ["folha-competencia", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_pagamento")
        .select("funcionario_id,loja_id,salario_base,total_proventos,total_descontos,liquido,fgts,status,fechada_em")
        .eq("competencia", competenciaDate(mes));
      if (error) throw error;
      return data as FolhaRow[];
    },
  });

  const folhaMap = useMemo(() => new Map(folha.map((r) => [r.funcionario_id, r])), [folha]);


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

  const { data: feriasRows = [] } = useQuery({
    queryKey: ["ferias-competencia", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_gozadas")
        .select("id,funcionario_id,dias_gozados,dias_vendidos,data_inicio_gozo,periodo_aquisitivo_inicio,periodo_aquisitivo_fim")
        .eq("competencia", `${mes}-01`);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: afastRows = [] } = useQuery({
    queryKey: ["afastamentos-competencia", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("afastamentos_inss")
        .select("id,funcionario_id,data_inicio,data_fim,tipo")
        .eq("competencia", `${mes}-01`);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const feriasMap = useMemo(
    () => new Map<string, any>(feriasRows.map((r) => [r.funcionario_id, r])),
    [feriasRows],
  );
  const afastMap = useMemo(
    () => new Map<string, any>(afastRows.map((r) => [r.funcionario_id, r])),
    [afastRows],
  );

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
  const funcMap = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  // Fechamento é por loja: cada funcionário com linha em folha_pagamento vira
  // histórico imutável; os demais continuam recalculando ao vivo.
  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => entraNaCompetencia(f, mes) || folhaMap.has(f.id))
      .filter((f) => lojaFiltro === "todas" || f.loja_id === lojaFiltro)
      .sort((a, b) => (a.nome > b.nome ? 1 : -1))
      .map((f) => {
        const hist = folhaMap.get(f.id) ?? null;
        return {
          f,
          hist,
          cc: hist
            ? null
            : calcContracheque(f, {
                planos: planosCfg,
                mes,
                faltas: faltasMap.get(f.id) ?? [],
                convenio: Number(convMap.get(f.id)?.valor ?? 0),
                salarioMinimoFederal,
                ferias: (feriasMap.get(f.id) as FeriasMes | undefined) ?? null,
                afastamento: (afastMap.get(f.id) as AfastamentoMes | undefined) ?? null,
              }),
        };
      });
  }, [folhaMap, funcionarios, lojaFiltro, mes, faltasMap, convMap, salarioMinimoFederal, planosCfg, feriasMap, afastMap]);

  // Escopo do botão: loja selecionada ou todas as lojas.
  const escopo = useMemo(() => {
    const elegiveis = funcionarios
      .filter((f) => entraNaCompetencia(f, mes) || folhaMap.has(f.id))
      .filter((f) => lojaFiltro === "todas" || f.loja_id === lojaFiltro);
    const fechados = elegiveis.filter((f) => folhaMap.has(f.id));
    const abertos = elegiveis.filter((f) => !folhaMap.has(f.id) && entraNaCompetencia(f, mes));
    return { elegiveis, fechados, abertos };
  }, [funcionarios, folhaMap, lojaFiltro, mes]);

  const fechada = escopo.fechados.length > 0 && escopo.abertos.length === 0;
  const parcial = escopo.fechados.length > 0 && escopo.abertos.length > 0;
  const fechadaEm = escopo.fechados[0] ? folhaMap.get(escopo.fechados[0].id)?.fechada_em ?? null : null;
  const escopoLabel = lojaFiltro === "todas" ? "todas as lojas" : lojaMap.get(lojaFiltro)?.nome ?? "loja";


  const totalLiquido = lista.reduce((s, i) => s + (i.hist ? Number(i.hist.liquido) : i.cc!.liquido), 0);
  const totalDescontos = lista.reduce(
    (s, i) => s + (i.hist ? Number(i.hist.total_descontos) : i.cc!.totalDescontos),
    0,
  );
  const totalConvenio = lista.reduce((s, i) => s + (i.hist ? 0 : i.cc!.convenio), 0);
  const cal = calendarioMes(mes);

  const fecharFolha = useMutation({
    mutationFn: async () => {
      const elegiveis = funcionarios.filter((f) => entraNaCompetencia(f, mes));
      if (elegiveis.length === 0) throw new Error("Nenhum funcionário elegível nesta competência.");
      const { data: userData } = await supabase.auth.getUser();
      const linhas = elegiveis.map((f) => {
        const cc = calcContracheque(f, {
          planos: planosCfg,
          mes,
          faltas: faltasMap.get(f.id) ?? [],
          convenio: Number(convMap.get(f.id)?.valor ?? 0),
          salarioMinimoFederal,
          ferias: (feriasMap.get(f.id) as FeriasMes | undefined) ?? null,
          afastamento: (afastMap.get(f.id) as AfastamentoMes | undefined) ?? null,
        });
        return {
          funcionario_id: f.id,
          loja_id: f.loja_id,
          competencia: competenciaDate(mes),
          salario_base: cc.salario,
          beneficios: cc.vaLiquido + cc.vtLiquido,
          inss: cc.inss,
          irrf: cc.irrf,
          fgts: cc.fgts,
          outros_descontos: Math.round((cc.totalDescontos - cc.inss - cc.irrf) * 100) / 100,
          total_proventos: cc.proventos,
          total_descontos: cc.totalDescontos,
          liquido: cc.liquido,
          custo_total: Math.round((cc.proventos + cc.fgts + cc.vaLiquido + cc.vtLiquido) * 100) / 100,
          status: "fechada",
          fechada_em: new Date().toISOString(),
          fechada_por: userData.user?.id ?? null,
        };
      });
      const { error } = await supabase.from("folha_pagamento").insert(linhas as any);
      if (error) throw error;
      return linhas.length;
    },
    onSuccess: (n) => {
      toast.success(`Folha de ${mes} fechada para ${n} funcionário(s).`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao fechar a folha"),
  });


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

  // Férias: grava também em ferias_gozadas, fechando o período aquisitivo em
  // curso e reiniciando a contagem para as provisões e para a Rescisão.
  const saveFerias = useMutation({
    mutationFn: async (v: {
      funcionario: Func;
      ativo: boolean;
      dias_gozados: number;
      dias_vendidos: number;
      data_inicio_gozo: string;
    }) => {
      const existente = feriasMap.get(v.funcionario.id);
      if (!v.ativo) {
        if (existente) {
          const { error } = await supabase.from("ferias_gozadas").delete().eq("id", existente.id);
          if (error) throw error;
        }
        return;
      }
      const inicio = periodoAquisitivoEmCurso(v.funcionario.data_admissao, v.data_inicio_gozo);
      const payload = {
        funcionario_id: v.funcionario.id,
        competencia: `${mes}-01`,
        data_inicio_gozo: v.data_inicio_gozo,
        dias_gozados: v.dias_gozados,
        dias_vendidos: v.dias_vendidos,
        periodo_aquisitivo_inicio: inicio.inicio,
        periodo_aquisitivo_fim: inicio.fim,
      };
      const { error } = await supabase
        .from("ferias_gozadas")
        .upsert(payload as any, { onConflict: "funcionario_id,competencia" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Férias atualizadas");
      qc.invalidateQueries();
      setEventoOpen(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar férias"),
  });

  const saveAfastamento = useMutation({
    mutationFn: async (v: {
      funcionario: Func;
      ativo: boolean;
      data_inicio: string;
      tipo: string;
    }) => {
      const existente = afastMap.get(v.funcionario.id);
      if (!v.ativo) {
        if (existente) {
          const { error } = await supabase.from("afastamentos_inss").delete().eq("id", existente.id);
          if (error) throw error;
        }
        return;
      }
      const { error } = await supabase.from("afastamentos_inss").upsert(
        {
          funcionario_id: v.funcionario.id,
          competencia: `${mes}-01`,
          data_inicio: v.data_inicio,
          tipo: v.tipo,
        } as any,
        { onConflict: "funcionario_id,competencia" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Afastamento atualizado");
      qc.invalidateQueries();
      setEventoOpen(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar afastamento"),
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
          {fechada ? (
            <Badge variant="secondary">Fechada em {fmtDataHora(fechadaEm)}</Badge>
          ) : (
            <>
              <Badge variant="outline">Competência aberta</Badge>
              {podeFechar(mes) && (
                <Button
                  variant="secondary"
                  disabled={fecharFolha.isPending}
                  onClick={() => {
                    if (confirm(`Fechar a folha de ${mes}? Depois disso o mês vira histórico e não recalcula mais.`))
                      fecharFolha.mutate();
                  }}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {fecharFolha.isPending ? "Fechando…" : "Fechar folha do mês"}
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      {fechada && (
        <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Competência fechada — valores gravados no histórico. Alterações no cadastro de funcionários ou em faltas
          não afetam mais este mês.
        </p>
      )}

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
              {lista.map(({ f, cc, hist }) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.cargo ?? "—"}
                      {afastMap.get(f.id) && (
                        <Badge variant="destructive" className="ml-2">Afastado (INSS)</Badge>
                      )}
                      {!afastMap.get(f.id) && feriasMap.get(f.id) && (
                        <Badge variant="secondary" className="ml-2">Férias</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{lojaMap.get(f.loja_id)?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {hist ? (
                      <span className="text-muted-foreground">—</span>
                    ) : cc!.faltas > 0 ? (
                      <Badge variant="destructive">{cc!.faltas}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{fmtBRL(hist ? Number(hist.total_proventos) : cc!.proventos)}</td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {hist ? "—" : cc!.descFaltas + cc!.descDsr > 0 ? `- ${fmtBRL(cc!.descFaltas + cc!.descDsr)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {hist ? "—" : cc!.convenio > 0 ? `- ${fmtBRL(cc!.convenio)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{fmtBRL(hist ? Number(hist.total_descontos) : cc!.totalDescontos)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtBRL(hist ? Number(hist.liquido) : cc!.liquido)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {hist ? (
                      <span className="text-xs text-muted-foreground">Somente leitura</span>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Férias / afastamento INSS"
                          onClick={() => setEventoOpen(f)}
                        >
                          <CalendarDays className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Lançar convênio" onClick={() => setConvOpen(f)}>
                          <ShoppingBasket className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Ver contracheque" onClick={() => setDetalhe(f)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Baixar contracheque em PDF" onClick={() => baixarPdf(f)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
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
              ferias={feriasMap.get(detalhe.id) ?? null}
              afastamento={afastMap.get(detalhe.id) ?? null}
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
      <Dialog open={!!eventoOpen} onOpenChange={(o) => !o && setEventoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Férias e afastamento — {eventoOpen?.nome}</DialogTitle>
          </DialogHeader>
          {eventoOpen && (
            <EventosMes
              func={eventoOpen}
              mes={mes}
              ferias={feriasMap.get(eventoOpen.id) ?? null}
              afastamento={afastMap.get(eventoOpen.id) ?? null}
              onFerias={(v) => saveFerias.mutate({ funcionario: eventoOpen, ...v })}
              onAfastamento={(v) => saveAfastamento.mutate({ funcionario: eventoOpen, ...v })}
              salvando={saveFerias.isPending || saveAfastamento.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** Período aquisitivo de 12 meses em curso na data do gozo. */
function periodoAquisitivoEmCurso(dataAdmissao: string | null | undefined, ref: string) {
  const base = dataAdmissao ? dataAdmissao.slice(0, 10) : ref.slice(0, 10);
  const [ay, am, ad] = base.split("-").map(Number);
  const [ry, rm, rd] = ref.slice(0, 10).split("-").map(Number);
  let inicio = new Date(Date.UTC(ay, am - 1, ad));
  const refDate = new Date(Date.UTC(ry, rm - 1, rd));
  let guard = 0;
  while (guard++ < 80) {
    const proximo = new Date(Date.UTC(inicio.getUTCFullYear() + 1, inicio.getUTCMonth(), inicio.getUTCDate()));
    if (proximo > refDate) {
      return {
        inicio: inicio.toISOString().slice(0, 10),
        fim: new Date(proximo.getTime() - 86400000).toISOString().slice(0, 10),
      };
    }
    inicio = proximo;
  }
  return { inicio: base, fim: base };
}

function EventosMes({
  func, mes, ferias, afastamento, onFerias, onAfastamento, salvando,
}: {
  func: Func;
  mes: string;
  ferias: any | null;
  afastamento: any | null;
  onFerias: (v: { ativo: boolean; dias_gozados: number; dias_vendidos: number; data_inicio_gozo: string }) => void;
  onAfastamento: (v: { ativo: boolean; data_inicio: string; tipo: string }) => void;
  salvando: boolean;
}) {
  const [emFerias, setEmFerias] = useState(!!ferias);
  const [dias, setDias] = useState<number>(Number(ferias?.dias_gozados ?? 30));
  const [vendeu, setVendeu] = useState<boolean>(Number(ferias?.dias_vendidos ?? 0) > 0);
  const [vendidos, setVendidos] = useState<number>(Number(ferias?.dias_vendidos ?? 0));
  const [inicioGozo, setInicioGozo] = useState<string>(ferias?.data_inicio_gozo ?? `${mes}-01`);

  const [afastado, setAfastado] = useState(!!afastamento);
  const [inicioAf, setInicioAf] = useState<string>(afastamento?.data_inicio ?? `${mes}-01`);
  const [tipoAf, setTipoAf] = useState<string>(afastamento?.tipo ?? "comum");

  const diasVendidosOk = !vendeu || (vendidos <= MAX_DIAS_VENDIDOS && dias + vendidos <= 30);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={emFerias} onChange={(e) => setEmFerias(e.target.checked)} />
          Em férias neste mês
        </label>
        {emFerias && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias gozados</Label>
              <Input type="number" min={1} max={30} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            </div>
            <div>
              <Label>Início do gozo</Label>
              <Input type="date" value={inicioGozo} onChange={(e) => setInicioGozo(e.target.value)} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vendeu} onChange={(e) => setVendeu(e.target.checked)} />
              Vendeu parte das férias (abono pecuniário)
            </label>
            {vendeu && (
              <div className="col-span-2">
                <Label>Dias vendidos à empresa (máx. {MAX_DIAS_VENDIDOS})</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_DIAS_VENDIDOS}
                  value={vendidos}
                  onChange={(e) => setVendidos(Number(e.target.value))}
                />
                {!diasVendidosOk && (
                  <p className="mt-1 text-xs text-destructive">
                    Dias gozados + vendidos não podem passar de 30 (CLT Art. 143).
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <Button
          size="sm"
          disabled={salvando || !diasVendidosOk}
          onClick={() =>
            onFerias({
              ativo: emFerias,
              dias_gozados: dias,
              dias_vendidos: vendeu ? vendidos : 0,
              data_inicio_gozo: inicioGozo,
            })
          }
        >
          Salvar férias
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Ao salvar, o período aquisitivo em curso é fechado e a contagem reinicia — refletindo na
          provisão de férias e no módulo de Rescisão.
        </p>
      </section>

      <section className="space-y-3 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={afastado} onChange={(e) => setAfastado(e.target.checked)} />
          Afastado pelo INSS neste mês
        </label>
        {afastado && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do afastamento</Label>
              <Input type="date" value={inicioAf} onChange={(e) => setInicioAf(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipoAf} onValueChange={setTipoAf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">Auxílio-doença comum</SelectItem>
                  <SelectItem value="acidentario">Acidentário (B91)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <Button
          size="sm"
          disabled={salvando}
          onClick={() => onAfastamento({ ativo: afastado, data_inicio: inicioAf, tipo: tipoAf })}
        >
          Salvar afastamento
        </Button>
        <p className="text-[11px] text-muted-foreground">
          A empresa paga apenas os 15 primeiros dias de afastamento; a partir do 16º o benefício é
          pago pelo INSS. Confirme casos específicos com a contabilidade — {func.nome} segue com FGTS
          devido durante o afastamento.
        </p>
      </section>
    </div>
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
  func, loja, mes, faltas, convenio, ferias, afastamento,
}: {
  func: Func; loja: string; mes: string; faltas: FaltaDia[]; convenio: number;
  ferias?: FeriasMes | null; afastamento?: AfastamentoMes | null;
}) {
  const { salarioMinimoFederal, planos: planosCfg } = useReferenciasSalariais();
  const cc = calcContracheque(func, {
    mes, faltas, convenio, salarioMinimoFederal, planos: planosCfg,
    ferias: ferias ?? null, afastamento: afastamento ?? null,
  });
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
        <Linha label={`Férias — 1/3 constitucional (${cc.diasFerias} dia(s))`} valor={cc.feriasTerco} />
        <Linha label={`Abono pecuniário (${cc.diasVendidos} dia(s) vendidos)`} valor={cc.abonoFerias} />
        <Linha label="Abono pecuniário — 1/3" valor={cc.abonoTerco} />
        <Linha label="13º salário — 1ª parcela (isenta)" valor={mes.endsWith("-11") ? cc.decimoNoMes : 0} />
        <Linha label="13º salário — 2ª parcela" valor={mes.endsWith("-12") ? cc.decimoNoMes : 0} />
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold">
          <span>Total de proventos</span><span>{fmtBRL(cc.proventos)}</span>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Descontos</div>
        <Linha label={`Faltas injustificadas (${cc.faltas} dia(s))`} valor={cc.descFaltas} negativo />
        <Linha label={`DSR perdido (${cc.dsrDias} semana(s))`} valor={cc.descDsr} negativo />
        <Linha label="Redução proporcional do valor extra" valor={cc.descExtra} negativo />
        <Linha
          label={`Afastamento INSS (${cc.diasSemPagamento} dia(s) pagos pelo INSS)`}
          valor={cc.descAfastamento}
          negativo
        />
        <Linha label="INSS" valor={cc.inss} negativo />
        <Linha label="IRRF" valor={cc.irrf} negativo />
        <Linha label="Vale-transporte (6%)" valor={cc.descontoVt} negativo />
        <Linha label="Convênio (compras na loja)" valor={cc.convenio} negativo />
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold">
          <span>Total de descontos</span><span className="text-destructive">- {fmtBRL(cc.totalDescontos)}</span>
        </div>
      </div>

      {(cc.va > 0 || cc.vt > 0 || cc.planoSaude > 0 || cc.planoOdonto > 0) && (
        <div className="rounded-md border p-3">
          <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Benefícios</div>
          <Linha label="Vale-alimentação (proporcional às faltas)" valor={cc.vaLiquido} muted />
          <Linha label="Redução por faltas (VA)" valor={cc.descVa} negativo muted />
          <Linha label="Vale-transporte" valor={cc.vtLiquido} muted />
          <Linha label="Plano de saúde" valor={cc.planoSaude} muted />
          <Linha label="Plano odontológico" valor={cc.planoOdonto} muted />
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
