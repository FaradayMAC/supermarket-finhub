import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CheckCircle2, RotateCcw, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/titulos")({
  head: () => ({
    meta: [
      { title: "Contas a pagar e receber · MercadoGest" },
      { name: "description", content: "Títulos financeiros com parcelamento, vencimentos, baixa de parcelas e integração automática com o fluxo de caixa." },
      { property: "og:title", content: "Contas a pagar e receber · MercadoGest" },
      { property: "og:description", content: "Controle de títulos a pagar e a receber por unidade, com parcelas, vencimentos e baixas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TitulosPage,
});

type Parcela = {
  id: string;
  titulo_id: string;
  numero: number;
  data_vencimento: string;
  valor: number;
  valor_pago: number;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  status: string;
};

type Titulo = {
  id: string;
  tipo: "pagar" | "receber";
  loja_id: string | null;
  fornecedor_id: string | null;
  categoria_id: string | null;
  descricao: string;
  numero_documento: string | null;
  data_emissao: string;
  valor_total: number;
  num_parcelas: number;
  status: string;
  lojas?: { nome: string; codigo: string } | null;
  fornecedores?: { razao_social: string; nome_fantasia: string | null } | null;
  titulo_parcelas?: Parcela[];
};

const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const dBR = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");
const addMeses = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  const dia = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < dia) d.setDate(0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const TIT_STATUS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  aberto: { label: "Aberto", variant: "outline" },
  parcial: { label: "Parcial", variant: "secondary" },
  quitado: { label: "Quitado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function statusParcela(p: Parcela) {
  if (p.status === "paga") return { label: "Paga", variant: "default" as const };
  if (p.status === "cancelada") return { label: "Cancelada", variant: "destructive" as const };
  if (p.data_vencimento < hojeISO()) return { label: "Vencida", variant: "destructive" as const };
  if (p.status === "parcial") return { label: "Parcial", variant: "secondary" as const };
  return { label: "Aberta", variant: "outline" as const };
}

function TitulosPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pagar" | "receber">("pagar");
  const [open, setOpen] = useState(false);
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, razao_social, nome_fantasia, condicao_pagamento_padrao").order("razao_social")).data ?? [],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias_despesa").select("id, nome").order("nome")).data ?? [],
  });

  const { data: titulos = [], isLoading } = useQuery({
    queryKey: ["titulos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titulos_financeiros")
        .select("*, lojas(nome, codigo), fornecedores(razao_social, nome_fantasia), titulo_parcelas(*)")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return (data as any as Titulo[]).map((t) => ({
        ...t,
        titulo_parcelas: (t.titulo_parcelas ?? []).slice().sort((a, b) => a.numero - b.numero),
      }));
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: { titulo: any; parcelas: { numero: number; data_vencimento: string; valor: number }[] }) => {
      const { data, error } = await supabase.from("titulos_financeiros").insert(payload.titulo).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("titulo_parcelas")
        .insert(payload.parcelas.map((p) => ({ ...p, titulo_id: data.id })));
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Título criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["titulos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: async (p: Parcela) => {
      const { error } = await supabase
        .from("titulo_parcelas")
        .update({ status: "paga", valor_pago: p.valor, data_pagamento: hojeISO() })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parcela baixada"); qc.invalidateQueries({ queryKey: ["titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const estornar = useMutation({
    mutationFn: async (p: Parcela) => {
      const { error } = await supabase
        .from("titulo_parcelas")
        .update({ status: "aberta", valor_pago: 0, data_pagamento: null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Baixa estornada"); qc.invalidateQueries({ queryKey: ["titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("titulos_financeiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Título excluído"); qc.invalidateQueries({ queryKey: ["titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = useMemo(
    () =>
      titulos.filter(
        (t) =>
          t.tipo === tab &&
          (filtroLoja === "todas" || t.loja_id === filtroLoja) &&
          (filtroStatus === "todos" || t.status === filtroStatus),
      ),
    [titulos, tab, filtroLoja, filtroStatus],
  );

  const resumo = useMemo(() => {
    const hoje = hojeISO();
    const em30 = addMeses(hoje, 1);
    let aberto = 0, vencido = 0, prox30 = 0, pago = 0;
    for (const t of filtrados) {
      for (const p of t.titulo_parcelas ?? []) {
        if (p.status === "cancelada") continue;
        if (p.status === "paga") { pago += Number(p.valor_pago); continue; }
        const saldo = Number(p.valor) - Number(p.valor_pago);
        aberto += saldo;
        if (p.data_vencimento < hoje) vencido += saldo;
        else if (p.data_vencimento <= em30) prox30 += saldo;
      }
    }
    return { aberto, vencido, prox30, pago };
  }, [filtrados]);

  const labelTipo = tab === "pagar" ? "a pagar" : "a receber";

  return (
    <AppShell
      title="Contas a pagar e receber"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Novo título</Button>
          </DialogTrigger>
          <TituloForm
            tipoInicial={tab}
            lojas={lojas as any}
            fornecedores={fornecedores as any}
            categorias={cats as any}
            saving={criar.isPending}
            onSubmit={(v) => criar.mutate(v)}
          />
        </Dialog>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="pagar">A pagar</TabsTrigger>
            <TabsTrigger value="receber">A receber</TabsTrigger>
          </TabsList>
          <Select value={filtroLoja} onValueChange={setFiltroLoja}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {(lojas as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ResumoCard titulo={`Em aberto (${labelTipo})`} valor={resumo.aberto} />
          <ResumoCard titulo="Vencido" valor={resumo.vencido} destaque icon={AlertTriangle} />
          <ResumoCard titulo="Vence em 30 dias" valor={resumo.prox30} icon={CalendarClock} />
          <ResumoCard titulo="Baixado" valor={resumo.pago} />
        </div>

        <TabsContent value={tab} className="mt-0 space-y-3">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && filtrados.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum título {labelTipo} neste filtro.</CardContent></Card>
          )}
          {filtrados.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-base">{t.descricao}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.lojas?.nome ?? "Sem unidade"}
                    {t.fornecedores ? ` · ${t.fornecedores.nome_fantasia || t.fornecedores.razao_social}` : ""}
                    {t.numero_documento ? ` · Doc ${t.numero_documento}` : ""} · Emissão {dBR(t.data_emissao)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={TIT_STATUS[t.status]?.variant ?? "outline"}>{TIT_STATUS[t.status]?.label ?? t.status}</Badge>
                  <span className="text-sm font-semibold">{fmtBRL(Number(t.valor_total))}</span>
                  <Button variant="ghost" size="icon" onClick={() => excluir.mutate(t.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3">Parcela</th>
                        <th className="py-2 pr-3">Vencimento</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3">Situação</th>
                        <th className="py-2 pr-3">Pagamento</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(t.titulo_parcelas ?? []).map((p) => {
                        const st = statusParcela(p);
                        return (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{p.numero}/{t.num_parcelas}</td>
                            <td className="py-2 pr-3">{dBR(p.data_vencimento)}</td>
                            <td className="py-2 pr-3 text-right">{fmtBRL(Number(p.valor))}</td>
                            <td className="py-2 pr-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {p.data_pagamento ? dBR(p.data_pagamento) : "—"}
                            </td>
                            <td className="py-2 text-right">
                              {p.status === "paga" ? (
                                <Button variant="ghost" size="sm" onClick={() => estornar.mutate(p)}>
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" />Estornar
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => baixar.mutate(p)}>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Baixar
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ResumoCard({ titulo, valor, destaque, icon: Icon }: { titulo: string; valor: number; destaque?: boolean; icon?: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}{titulo}
        </div>
        <div className={`mt-1 text-xl font-bold ${destaque && valor > 0 ? "text-destructive" : ""}`}>{fmtBRL(valor)}</div>
      </CardContent>
    </Card>
  );
}

function TituloForm({
  tipoInicial, lojas, fornecedores, categorias, onSubmit, saving,
}: {
  tipoInicial: "pagar" | "receber";
  lojas: { id: string; nome: string; codigo: string }[];
  fornecedores: { id: string; razao_social: string; nome_fantasia: string | null }[];
  categorias: { id: string; nome: string }[];
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [tipo, setTipo] = useState<"pagar" | "receber">(tipoInicial);
  const [lojaId, setLojaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [catId, setCatId] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO());

  const previa = useMemo(() => {
    const n = Math.max(1, Math.round(num(parcelas)));
    const total = Math.round(num(valor) * 100);
    if (!total) return [] as { numero: number; data_vencimento: string; valor: number }[];
    const base = Math.floor(total / n);
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      data_vencimento: addMeses(primeiroVenc, i),
      valor: (i === n - 1 ? base + (total - base * n) : base) / 100,
    }));
  }, [valor, parcelas, primeiroVenc]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Novo título</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!lojaId) return toast.error("Selecione a unidade");
          if (previa.length === 0) return toast.error("Informe o valor total");
          onSubmit({
            titulo: {
              tipo,
              loja_id: lojaId,
              fornecedor_id: fornecedorId || null,
              categoria_id: catId || null,
              descricao: String(fd.get("descricao") || "").trim(),
              numero_documento: String(fd.get("doc") || "").trim() || null,
              data_emissao: String(fd.get("emissao") || hojeISO()),
              valor_total: num(valor),
              num_parcelas: previa.length,
            },
            parcelas: previa,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagar">A pagar</SelectItem>
                <SelectItem value="receber">A receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unidade *</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Descrição *</Label>
            <Input name="descricao" required placeholder="Ex.: NF 1234 — Distribuidora X" />
          </div>
          <div>
            <Label>Fornecedor / cliente</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nº documento</Label>
            <Input name="doc" placeholder="NF / boleto" />
          </div>
          <div>
            <Label>Emissão</Label>
            <Input name="emissao" type="date" defaultValue={hojeISO()} />
          </div>
          <div>
            <Label>Valor total *</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" required />
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input value={parcelas} onChange={(e) => setParcelas(e.target.value)} inputMode="numeric" />
          </div>
          <div className="col-span-2">
            <Label>1º vencimento</Label>
            <Input type="date" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} />
          </div>
        </div>

        {previa.length > 0 && (
          <div className="rounded-md border p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Prévia das parcelas</div>
            <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {previa.map((p) => (
                <div key={p.numero} className="flex justify-between">
                  <span className="text-muted-foreground">{p.numero}/{previa.length} · {dBR(p.data_vencimento)}</span>
                  <span className="font-medium">{fmtBRL(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar título"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
