import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Calculator, Plane, PiggyBank, Download, FileText } from "lucide-react";
import {
  exportarRotatividadeCsv,
  exportarRotatividadePdf,
} from "@/lib/rotatividade-export";
import { toast } from "sonner";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { CUSTO_SELECT } from "@/lib/custo-funcionario";
import {
  calcRescisao,
  hojeUTCDate,
  isoDate,
  parseDateUTC,
  periodosAquisitivos,
  provisaoDecimoTerceiro,
  provisaoFerias,
  saldoFgts,
  TIPOS_RESCISAO,
  FORMAS_CUMPRIMENTO_AVISO,
  type FeriasGozadas,
  type TipoRescisao,
  type ModalidadeAviso,
  type FormaCumprimentoAviso,
} from "@/lib/rescisao";

export const Route = createFileRoute("/_authenticated/rescisao")({
  head: () => ({
    meta: [
      { title: "Rescisão · MercadoGest" },
      {
        name: "description",
        content:
          "Simulador de rescisão trabalhista por funcionário: custo para a empresa e valor líquido recebido.",
      },
      { property: "og:title", content: "Rescisão · MercadoGest" },
      {
        property: "og:description",
        content: "Simule verbas rescisórias, provisões de férias e 13º e saldo de FGTS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RescisaoPage,
});

type Func = any;

function RescisaoPage() {
  const qc = useQueryClient();
  const { salarioMinimoFederal } = useReferenciasSalariais();
  const [filtro, setFiltro] = useState("todas");
  const [sim, setSim] = useState<Func | null>(null);
  const [feriasDe, setFeriasDe] = useState<Func | null>(null);
  const [fgtsDe, setFgtsDe] = useState<Func | null>(null);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () =>
      (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });

  const { data: funcs = [], isLoading } = useQuery({
    queryKey: ["rescisao-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          `${CUSTO_SELECT.replace(
            "lojas(empresa_id, empresas(regime_tributario))",
            "lojas(nome, codigo, empresa_id, empresas(regime_tributario))",
          )}, nome, cargo, fgts_saldo_inicial, fgts_saldo_inicial_data`,
        )
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ["ferias-gozadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_gozadas")
        .select("*")
        .order("data_inicio_gozo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: saques = [] } = useQuery({
    queryKey: ["fgts-saques"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fgts_saques")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // FGTS depositado via competências de folha fechadas
  const { data: folhas = [] } = useQuery({
    queryKey: ["folha-fgts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_pagamento")
        .select("funcionario_id, competencia, fgts");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const feriasPorFunc = useMemo(() => {
    const m = new Map<string, FeriasGozadas[]>();
    for (const f of ferias) {
      const arr = m.get(f.funcionario_id) ?? [];
      arr.push(f);
      m.set(f.funcionario_id, arr);
    }
    return m;
  }, [ferias]);

  function fgtsInput(f: Func, ref: Date) {
    const inicio = parseDateUTC(f.fgts_saldo_inicial_data) ?? parseDateUTC(f.data_admissao);
    const depositos = folhas
      .filter((x) => x.funcionario_id === f.id)
      .filter((x) => {
        const c = parseDateUTC(x.competencia);
        if (!c) return false;
        if (inicio && c < inicio) return false;
        return c <= ref;
      })
      .reduce((s, x) => s + (Number(x.fgts) || 0), 0);
    const sq = saques
      .filter((x) => x.funcionario_id === f.id)
      .filter((x) => {
        const d = parseDateUTC(x.data);
        return d ? d <= ref : false;
      })
      .reduce((s, x) => s + (Number(x.valor) || 0), 0);
    return {
      saldoInicial: Number(f.fgts_saldo_inicial) || 0,
      depositos,
      saques: sq,
    };
  }

  const hoje = hojeUTCDate();
  const filtrados = useMemo(
    () => (filtro === "todas" ? funcs : funcs.filter((f) => f.loja_id === filtro)),
    [funcs, filtro],
  );

  const totais = useMemo(() => {
    let ferias13 = 0;
    let dec = 0;
    for (const f of filtrados) {
      ferias13 += provisaoFerias(f, feriasPorFunc.get(f.id) ?? [], hoje, salarioMinimoFederal).total;
      dec += provisaoDecimoTerceiro(f, hoje, salarioMinimoFederal).total;
    }
    return { ferias: ferias13, dec };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, feriasPorFunc, salarioMinimoFederal]);

  const delFerias = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ferias_gozadas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["ferias-gozadas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const addFerias = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("ferias_gozadas").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Férias lançadas");
      qc.invalidateQueries({ queryKey: ["ferias-gozadas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const addSaque = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("fgts_saques").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saque lançado");
      qc.invalidateQueries({ queryKey: ["fgts-saques"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const delSaque = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fgts_saques").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saque removido");
      qc.invalidateQueries({ queryKey: ["fgts-saques"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const salvarSaldoInicial = useMutation({
    mutationFn: async ({ id, valor, data }: { id: string; valor: number; data: string | null }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ fgts_saldo_inicial: valor, fgts_saldo_inicial_data: data })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saldo inicial salvo");
      qc.invalidateQueries({ queryKey: ["rescisao-funcionarios"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const confirmarDesligamento = useMutation({
    mutationFn: async ({
      id,
      data,
      motivo,
      observacao,
    }: {
      id: string;
      data: string;
      motivo: TipoRescisao;
      observacao: string;
    }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({
          ativo: false,
          data_desligamento: data,
          motivo_desligamento: motivo,
          observacao_desligamento: observacao.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desligamento confirmado");
      setSim(null);
      qc.invalidateQueries({ queryKey: ["rescisao-funcionarios"] });
      qc.invalidateQueries({ queryKey: ["rotatividade"] });
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <AppShell title="Rescisão">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja:</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {(lojas as any[]).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome} ({l.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Provisão de férias:{" "}
            <span className="font-semibold text-foreground">{fmtBRL(totais.ferias)}</span>
          </span>
          <span>
            Provisão de 13º:{" "}
            <span className="font-semibold text-foreground">{fmtBRL(totais.dec)}</span>
          </span>
        </div>
      </div>

      <Tabs defaultValue="simulacao">
        <TabsList className="mb-4">
          <TabsTrigger value="simulacao">Simulação</TabsTrigger>
          <TabsTrigger value="rotatividade">Rotatividade</TabsTrigger>
        </TabsList>

        <TabsContent value="simulacao">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Admissão</th>
                <th className="px-4 py-3 text-right">Salário</th>
                <th className="px-4 py-3 text-right">Provisão férias</th>
                <th className="px-4 py-3 text-right">Provisão 13º</th>
                <th className="px-4 py-3 text-right">Saldo FGTS</th>
                <th className="px-4 py-3 text-right">Custo rescisão (hoje)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    Sem funcionários ativos neste filtro.
                  </td>
                </tr>
              )}
              {filtrados.map((f) => {
                const g = feriasPorFunc.get(f.id) ?? [];
                const pf = provisaoFerias(f, g, hoje, salarioMinimoFederal);
                const p13 = provisaoDecimoTerceiro(f, hoje, salarioMinimoFederal);
                const fg = saldoFgts(fgtsInput(f, hoje));
                const r = calcRescisao(f, {
                  tipo: "sem_justa_causa",
                  ref: hoje,
                  gozadas: g,
                  fgts: fgtsInput(f, hoje),
                  salarioMinimoFederal,
                });
                return (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {f.nome}
                      <span className="block text-[11px] text-muted-foreground">
                        {f.cargo ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{f.lojas?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {f.data_admissao
                        ? new Date(f.data_admissao + "T00:00:00Z").toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtBRL(Number(f.salario_base) || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      {fmtBRL(pf.total)}
                      <span className="block text-[10px] text-muted-foreground">
                        {pf.meses}/12 avos
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmtBRL(p13.total)}
                      <span className="block text-[10px] text-muted-foreground">
                        {p13.meses}/12 avos
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{fmtBRL(fg)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {fmtBRL(r.custoEmpresa)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSim(f)}>
                          <Calculator className="h-4 w-4" /> Simular rescisão
                        </Button>
                        <Button size="icon" variant="ghost" title="Férias gozadas" onClick={() => setFeriasDe(f)}>
                          <Plane className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="FGTS" onClick={() => setFgtsDe(f)}>
                          <PiggyBank className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Simulação de valor: não processa desligamento, não gera TRCT e não altera o cadastro. A
        incidência de INSS/IRRF por verba segue o tratamento padrão (saldo de salário e 13º
        tributados; aviso prévio e férias indenizadas isentos) — confira com a contabilidade antes
        de usar os números para decisão financeira.
      </p>

        </TabsContent>

        <TabsContent value="rotatividade">
          <Rotatividade filtro={filtro} />
        </TabsContent>
      </Tabs>

      {/* Simulação */}
      <Dialog open={!!sim} onOpenChange={(v) => !v && setSim(null)}>
        {sim && (
          <SimulacaoDialog
            f={sim}
            gozadas={feriasPorFunc.get(sim.id) ?? []}
            fgtsInput={fgtsInput}
            salarioMinimoFederal={salarioMinimoFederal}
            confirmando={confirmarDesligamento.isPending}
            onConfirmar={({ data, motivo, observacao }) =>
              confirmarDesligamento.mutate({ id: sim.id, data, motivo, observacao })
            }
          />
        )}
      </Dialog>

      {/* Férias gozadas */}
      <Dialog open={!!feriasDe} onOpenChange={(v) => !v && setFeriasDe(null)}>
        {feriasDe && (
          <FeriasDialog
            f={feriasDe}
            registros={feriasPorFunc.get(feriasDe.id) ?? []}
            onAdd={(p) => addFerias.mutate(p)}
            onDelete={(id) => delFerias.mutate(id)}
            saving={addFerias.isPending}
          />
        )}
      </Dialog>

      {/* FGTS */}
      <Dialog open={!!fgtsDe} onOpenChange={(v) => !v && setFgtsDe(null)}>
        {fgtsDe && (
          <FgtsDialog
            f={fgtsDe}
            saques={saques.filter((s) => s.funcionario_id === fgtsDe.id)}
            depositos={fgtsInput(fgtsDe, hoje).depositos}
            onAddSaque={(p) => addSaque.mutate(p)}
            onDeleteSaque={(id) => delSaque.mutate(id)}
            onSaveSaldo={(valor, data) =>
              salvarSaldoInicial.mutate({ id: fgtsDe.id, valor, data })
            }
          />
        )}
      </Dialog>
    </AppShell>
  );
}

function Linha({
  label,
  valor,
  detalhe,
  destaque,
}: {
  label: string;
  valor: number;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-start justify-between border-b py-2 last:border-0">
      <div>
        <span className={destaque ? "font-semibold" : ""}>{label}</span>
        {detalhe && <span className="block text-xs text-muted-foreground">{detalhe}</span>}
      </div>
      <span className={destaque ? "font-semibold" : ""}>{fmtBRL(valor)}</span>
    </div>
  );
}

function SimulacaoDialog({
  f,
  gozadas,
  fgtsInput,
  salarioMinimoFederal,
  onConfirmar,
  confirmando,
}: {
  f: any;
  gozadas: FeriasGozadas[];
  fgtsInput: (f: any, ref: Date) => { saldoInicial: number; depositos: number; saques: number };
  salarioMinimoFederal: number;
  onConfirmar: (p: { data: string; motivo: TipoRescisao; observacao: string }) => void;
  confirmando: boolean;
}) {
  const [tipo, setTipo] = useState<TipoRescisao>("sem_justa_causa");
  const [observacao, setObservacao] = useState("");
  const [modalidadeAviso, setModalidadeAviso] = useState<ModalidadeAviso>("indenizado");
  const [formaCumprimento, setFormaCumprimento] =
    useState<FormaCumprimentoAviso>("reducao_7_dias");
  const [dataRef, setDataRef] = useState(isoDate(hojeUTCDate()));
  const ref = parseDateUTC(dataRef) ?? hojeUTCDate();
  const temAviso = tipo === "sem_justa_causa" || tipo === "acordo_mutuo";
  const r = calcRescisao(f, {
    tipo,
    ref,
    gozadas,
    fgts: fgtsInput(f, ref),
    salarioMinimoFederal,
    modalidadeAviso: temAviso ? modalidadeAviso : "indenizado",
  });
  const tipoInfo = TIPOS_RESCISAO.find((t) => t.value === tipo)!;
  const trabalhado = temAviso && modalidadeAviso === "trabalhado";

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Simular rescisão — {f.nome}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo de rescisão</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRescisao)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_RESCISAO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{tipoInfo.descricao}</p>
        </div>
        <div>
          <Label>Data de referência</Label>
          <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Remuneração base: {fmtBRL(r.remuneracao)} (salário + adicionais)
          </p>
        </div>
      </div>

      {temAviso && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Modalidade do aviso prévio</Label>
            <Select
              value={modalidadeAviso}
              onValueChange={(v) => setModalidadeAviso(v as ModalidadeAviso)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indenizado">Indenizado</SelectItem>
                <SelectItem value="trabalhado">Trabalhado</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {trabalhado
                ? `Somente os ${r.diasExcedentes} dia(s) excedentes a 30 são indenizados.`
                : `Todos os ${r.diasAviso} dias entram como indenização.`}
            </p>
          </div>
          {trabalhado && (
            <div>
              <Label>Forma de cumprimento</Label>
              <Select
                value={formaCumprimento}
                onValueChange={(v) => setFormaCumprimento(v as FormaCumprimentoAviso)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_CUMPRIMENTO_AVISO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Informativo: salário pago integral, sem efeito no valor calculado.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Custo total para a empresa
            </div>
            <div className="mt-1 text-2xl font-bold">{fmtBRL(r.custoEmpresa)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Recebido pelo funcionário
            </div>
            <div className="mt-1 text-2xl font-bold">{fmtBRL(r.recebidoFuncionario)}</div>
            <div className="text-xs text-muted-foreground">
              líquido no TRCT {fmtBRL(r.liquidoTrct)} + FGTS/multa
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Verbas rescisórias
        </div>
        <Linha
          label="Saldo de salário"
          valor={r.saldoSalario}
          detalhe={`${r.diasTrabalhadosMes} dia(s) trabalhados no mês`}
        />
        <Linha
          label={
            trabalhado
              ? "Aviso prévio (dias excedentes indenizados)"
              : "Aviso prévio indenizado"
          }
          valor={r.avisoPrevio}
          detalhe={
            r.fatorAviso === 0
              ? "não devido neste tipo de rescisão"
              : trabalhado
                ? `${r.diasAvisoIndenizados} de ${r.diasAviso} dias — os 30 dias-base são pagos pela folha normal${r.fatorAviso < 1 ? " × 50% (acordo mútuo)" : ""}`
                : `${r.diasAviso} dias${r.fatorAviso < 1 ? " × 50% (acordo mútuo)" : ""}`
          }
        />
        <Linha
          label="Férias vencidas + 1/3"
          valor={r.vencidas.total}
          detalhe={`${r.vencidas.dias} dia(s) em aberto de períodos aquisitivos completos`}
        />
        <Linha
          label="Férias proporcionais + 1/3"
          valor={r.feriasProporcionais.total}
          detalhe={`${r.feriasProporcionais.meses}/12 avos`}
        />
        <Linha
          label="13º proporcional"
          valor={r.decimoTerceiro.total}
          detalhe={`${r.decimoTerceiro.meses}/12 avos`}
        />
        <Linha label="Total bruto das verbas" valor={r.totalBruto} destaque />
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Descontos (verbas tributáveis: {fmtBRL(r.verbasTributaveis)})
        </div>
        <Linha label="INSS" valor={r.inss} />
        <Linha label="IRRF" valor={r.irrf} />
        <Linha label="Líquido do TRCT" valor={r.liquidoTrct} destaque />
        <p className="mt-2 text-xs text-muted-foreground">
          Verbas indenizadas isentas de INSS: {fmtBRL(r.verbasIndenizadas)}
        </p>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          FGTS
        </div>
        <Linha label="Saldo acumulado na conta vinculada" valor={r.fgtsAcumulado} />
        <Linha
          label="FGTS do mês da rescisão"
          valor={r.fgtsDoMes}
          detalhe="8% sobre saldo de salário e aviso prévio"
        />
        <Linha
          label={`Multa rescisória (${r.pctMulta}%)`}
          valor={r.multaFgts}
          detalhe={r.pctMulta === 0 ? "não devida neste tipo de rescisão" : undefined}
        />
        <Linha
          label={`Disponível para saque (${r.pctSaque}%)`}
          valor={r.fgtsSacavel}
          detalhe="pago pela conta vinculada, fora do TRCT"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Observação do desligamento</Label>
        <Textarea
          rows={2}
          placeholder="Descreva o que motivou o desligamento"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>

      <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Confirmar grava a data de referência, o tipo de rescisão e a observação no cadastro e
          inativa o funcionário.
        </p>
        <Button
          disabled={confirmando}
          onClick={() => onConfirmar({ data: isoDate(ref), motivo: tipo, observacao })}
        >
          Confirmar desligamento
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function FeriasDialog({
  f,
  registros,
  onAdd,
  onDelete,
  saving,
}: {
  f: any;
  registros: FeriasGozadas[];
  onAdd: (p: any) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const hoje = hojeUTCDate();
  const periodos = periodosAquisitivos(f.data_admissao, hoje, registros);
  const [periodo, setPeriodo] = useState<string>(
    periodos.find((p) => p.completo && p.diasEmAberto > 0)
      ? isoDate(periodos.find((p) => p.completo && p.diasEmAberto > 0)!.inicio)
      : periodos[0]
        ? isoDate(periodos[0].inicio)
        : "",
  );
  const [inicioGozo, setInicioGozo] = useState("");
  const [dias, setDias] = useState(30);
  const sel = periodos.find((p) => isoDate(p.inicio) === periodo) ?? null;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Férias gozadas — {f.nome}</DialogTitle>
      </DialogHeader>

      {periodos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Informe a data de admissão do funcionário para controlar períodos aquisitivos.
        </p>
      )}

      {periodos.length > 0 && (
        <>
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Períodos aquisitivos
            </div>
            {periodos.map((p) => (
              <div key={isoDate(p.inicio)} className="flex items-center justify-between py-1">
                <span>
                  {p.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a{" "}
                  {p.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </span>
                {p.completo ? (
                  p.diasEmAberto === 0 ? (
                    <Badge variant="secondary">Quitado ({p.diasGozados} dias)</Badge>
                  ) : (
                    <Badge variant="destructive">{p.diasEmAberto} dias vencidos</Badge>
                  )
                ) : (
                  <Badge variant="outline">Em curso</Badge>
                )}
              </div>
            ))}
          </div>

          <form
            className="grid grid-cols-3 items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sel) return toast.error("Selecione o período aquisitivo");
              if (!inicioGozo) return toast.error("Informe a data de início do gozo");
              if (!dias || dias <= 0) return toast.error("Informe os dias gozados");
              onAdd({
                funcionario_id: f.id,
                periodo_aquisitivo_inicio: isoDate(sel.inicio),
                periodo_aquisitivo_fim: isoDate(sel.fim),
                data_inicio_gozo: inicioGozo,
                dias_gozados: dias,
              });
              setInicioGozo("");
            }}
          >
            <div>
              <Label>Período aquisitivo</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p) => (
                    <SelectItem key={isoDate(p.inicio)} value={isoDate(p.inicio)}>
                      {p.inicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} —{" "}
                      {p.fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início do gozo</Label>
              <Input
                type="date"
                value={inicioGozo}
                onChange={(e) => setInicioGozo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Dias</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                />
              </div>
              <Button type="submit" disabled={saving} className="self-end">
                <Plus className="h-4 w-4" /> Lançar
              </Button>
            </div>
          </form>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Período aquisitivo</th>
                  <th className="px-3 py-2">Início do gozo</th>
                  <th className="px-3 py-2 text-center">Dias</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhuma férias lançada.
                    </td>
                  </tr>
                )}
                {registros.map((g: any) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {new Date(g.periodo_aquisitivo_inicio + "T00:00:00Z").toLocaleDateString(
                        "pt-BR",
                        { timeZone: "UTC" },
                      )}{" "}
                      —{" "}
                      {new Date(g.periodo_aquisitivo_fim + "T00:00:00Z").toLocaleDateString(
                        "pt-BR",
                        { timeZone: "UTC" },
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(g.data_inicio_gozo + "T00:00:00Z").toLocaleDateString("pt-BR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="px-3 py-2 text-center">{g.dias_gozados}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => onDelete(g.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DialogContent>
  );
}

function FgtsDialog({
  f,
  saques,
  depositos,
  onAddSaque,
  onDeleteSaque,
  onSaveSaldo,
}: {
  f: any;
  saques: any[];
  depositos: number;
  onAddSaque: (p: any) => void;
  onDeleteSaque: (id: string) => void;
  onSaveSaldo: (valor: number, data: string | null) => void;
}) {
  const [saldo, setSaldo] = useState<number>(Number(f.fgts_saldo_inicial) || 0);
  const [saldoData, setSaldoData] = useState<string>(f.fgts_saldo_inicial_data ?? "");
  const [data, setData] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [motivo, setMotivo] = useState("");
  const totalSaques = saques.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const disponivel = saldoFgts({ saldoInicial: saldo, depositos, saques: totalSaques });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>FGTS — {f.nome}</DialogTitle>
      </DialogHeader>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Saldo inicial (histórico anterior ao sistema)
        </div>
        <div className="grid grid-cols-3 items-end gap-3">
          <div>
            <Label>Saldo acumulado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={saldo}
              onChange={(e) => setSaldo(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Data de referência</Label>
            <Input
              type="date"
              value={saldoData}
              onChange={(e) => setSaldoData(e.target.value)}
            />
          </div>
          <Button onClick={() => onSaveSaldo(saldo, saldoData || null)}>Salvar saldo</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Preencha apenas para funcionários já contratados antes de o sistema controlar o FGTS.
          Quem for admitido a partir de agora acumula sozinho pelo contracheque.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Depositado pelo sistema</div>
          <div className="font-semibold">{fmtBRL(depositos)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Saques lançados</div>
          <div className="font-semibold">{fmtBRL(totalSaques)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Saldo disponível</div>
          <div className="font-semibold">{fmtBRL(disponivel)}</div>
        </div>
      </div>

      <form
        className="grid grid-cols-4 items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!data) return toast.error("Informe a data do saque");
          if (!valor || valor <= 0) return toast.error("Informe o valor do saque");
          onAddSaque({ funcionario_id: f.id, data, valor, motivo: motivo || null });
          setData("");
          setValor(0);
          setMotivo("");
        }}
      >
        <div>
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Motivo</Label>
          <Input
            value={motivo}
            placeholder="saque-aniversário, imóvel…"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" /> Lançar saque
        </Button>
      </form>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {saques.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum saque lançado.
                </td>
              </tr>
            )}
            {saques.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {new Date(s.data + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{s.motivo ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(Number(s.valor) || 0)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => onDeleteSaque(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DialogFooter />
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Relatório de rotatividade — funcionários desligados por competência
// ---------------------------------------------------------------------------

function tempoDeCasa(admissao?: string | null, desligamento?: string | null) {
  const a = parseDateUTC(admissao);
  const d = parseDateUTC(desligamento);
  if (!a || !d || d < a) return "—";
  let meses =
    (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + (d.getUTCMonth() - a.getUTCMonth());
  if (d.getUTCDate() < a.getUTCDate()) meses -= 1;
  meses = Math.max(0, meses);
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto} mês(es)`;
  return resto === 0 ? `${anos} ano(s)` : `${anos} ano(s) e ${resto} mês(es)`;
}

const fmtData = (v?: string | null) =>
  v ? new Date(String(v).slice(0, 10) + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

function Rotatividade({ filtro }: { filtro: string }) {
  const qc = useQueryClient();
  const agora = new Date();
  const [mes, setMes] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`,
  );
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const { data: desligados = [], isLoading } = useQuery({
    queryKey: ["rotatividade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id, nome, cargo, loja_id, data_admissao, data_desligamento, motivo_desligamento, observacao_desligamento, lojas(nome, codigo)",
        )
        .not("data_desligamento", "is", null)
        .order("data_desligamento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const salvarObs = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("funcionarios")
        .update({ observacao_desligamento: texto.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação salva");
      qc.invalidateQueries({ queryKey: ["rotatividade"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const lista = useMemo(
    () =>
      desligados
        .filter((f) => String(f.data_desligamento).slice(0, 7) === mes)
        .filter((f) => filtro === "todas" || f.loja_id === filtro),
    [desligados, mes, filtro],
  );

  const porMotivo = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of lista) {
      const k = f.motivo_desligamento ?? "nao_informado";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [lista]);

  const labelMotivo = (v: string | null) =>
    TIPOS_RESCISAO.find((t) => t.value === v)?.label ?? "Não informado";

  const lojaLabel =
    filtro === "todas" ? "Todas as lojas" : (lista[0]?.lojas?.nome ?? "Loja selecionada");

  const linhasExport = useMemo(
    () =>
      lista.map((f) => ({
        nome: f.nome,
        cargo: f.cargo ?? "—",
        loja: f.lojas?.nome ?? "—",
        admissao: fmtData(f.data_admissao),
        desligamento: fmtData(f.data_desligamento),
        tempo: tempoDeCasa(f.data_admissao, f.data_desligamento),
        tipo: labelMotivo(f.motivo_desligamento),
        motivo: f.observacao_desligamento ?? "—",
      })),
    [lista],
  );

  const resumoExport = porMotivo.map(([k, n]) => ({
    motivo: labelMotivo(k === "nao_informado" ? null : k),
    qtd: n,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Competência:</Label>
        <Input type="month" className="w-44" value={mes} onChange={(e) => setMes(e.target.value)} />
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{lista.length}</span> desligamento(s) no
          período
        </span>
        <div className="flex flex-wrap gap-1">
          {porMotivo.map(([k, n]) => (
            <Badge key={k} variant="secondary">
              {n} · {labelMotivo(k === "nao_informado" ? null : k)}
            </Badge>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!lista.length}
            onClick={() =>
              exportarRotatividadeCsv({
                linhas: linhasExport,
                mes,
                loja: lojaLabel,
                resumo: resumoExport,
              })
            }
          >
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!lista.length}
            onClick={async () => {
              try {
                await exportarRotatividadePdf({
                  linhas: linhasExport,
                  mes,
                  loja: lojaLabel,
                  resumo: resumoExport,
                });
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao gerar PDF");
              }
            }}
          >
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Admissão</th>
                <th className="px-4 py-3">Desligamento</th>
                <th className="px-4 py-3">Tempo de casa</th>
                <th className="px-4 py-3">Tipo de rescisão</th>
                <th className="px-4 py-3 min-w-[260px]">Motivo (observação)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && lista.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum desligamento neste período.
                  </td>
                </tr>
              )}
              {lista.map((f) => {
                const valor = rascunhos[f.id] ?? f.observacao_desligamento ?? "";
                const alterado = valor !== (f.observacao_desligamento ?? "");
                return (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{f.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.cargo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.lojas?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtData(f.data_admissao)}</td>
                    <td className="px-4 py-3">{fmtData(f.data_desligamento)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tempoDeCasa(f.data_admissao, f.data_desligamento)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{labelMotivo(f.motivo_desligamento)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Textarea
                          rows={2}
                          placeholder="Descreva o motivo do desligamento"
                          className="min-w-[220px] text-sm"
                          value={valor}
                          onChange={(e) =>
                            setRascunhos((r) => ({ ...r, [f.id]: e.target.value }))
                          }
                        />
                        {alterado && (
                          <Button
                            size="sm"
                            disabled={salvarObs.isPending}
                            onClick={() => salvarObs.mutate({ id: f.id, texto: valor })}
                          >
                            Salvar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
