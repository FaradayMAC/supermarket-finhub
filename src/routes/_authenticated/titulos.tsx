import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FiltroBar, useFiltroBar } from "@/components/filtro-bar";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CheckCircle2, RotateCcw, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/titulos")({
  head: () => ({
    meta: [
      { title: "Contas a pagar e receber · MercadoGest" },
      { name: "description", content: "Títulos financeiros por parcela, com vencimento, origem (despesa, compra, imposto, folha), baixa e reflexo automático no fluxo de caixa." },
      { property: "og:title", content: "Contas a pagar e receber · MercadoGest" },
      { property: "og:description", content: "Controle de títulos a pagar e a receber por unidade, com parcelas, vencimentos, atrasos e baixas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TitulosPage,
});

type Titulo = {
  id: string;
  tipo: "pagar" | "receber";
  origem: string;
  origem_id: string | null;
  loja_id: string | null;
  fornecedor_id: string | null;
  cliente_ref: string | null;
  categoria_id: string | null;
  descricao: string;
  numero_documento: string | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento_previsto: string | null;
  data_pagamento_efetivo: string | null;
  valor: number;
  valor_pago: number;
  forma_pagamento: string | null;
  numero_parcela: number;
  total_parcelas: number;
  status: string;
  lojas?: { nome: string; codigo: string } | null;
  fornecedores?: { razao_social: string; nome_fantasia: string | null } | null;
};

const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const dBR = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const addMeses = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  const dia = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < dia) d.setDate(0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const STATUS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  aberto: { label: "Aberto", variant: "outline" },
  parcial: { label: "Parcial", variant: "secondary" },
  pago: { label: "Pago", variant: "default" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};
const ORIGEM_LABEL: Record<string, string> = {
  manual: "Manual",
  despesa: "Despesa",
  compra: "Compra",
  imposto: "Imposto",
  folha: "Folha",
  venda_cartao: "Venda cartão",
};

function TitulosPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pagar" | "receber">("pagar");
  const [open, setOpen] = useState(false);
  const filtro = useFiltroBar("tudo");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo, empresa_id").order("nome")).data ?? [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, razao_social, nome_fantasia").order("razao_social")).data ?? [],
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
        .select("*, lojas(nome, codigo), fornecedores(razao_social, nome_fantasia)")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data as any as Titulo[];
    },
  });

  const criar = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("titulos_financeiros").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Título lançado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["titulos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: async (t: Titulo) => {
      const { error } = await supabase
        .from("titulos_financeiros")
        .update({ status: "pago", valor_pago: t.valor, data_pagamento_efetivo: hojeISO() })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Título baixado"); qc.invalidateQueries({ queryKey: ["titulos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const estornar = useMutation({
    mutationFn: async (t: Titulo) => {
      const { error } = await supabase
        .from("titulos_financeiros")
        .update({ status: "aberto", valor_pago: 0, data_pagamento_efetivo: null })
        .eq("id", t.id);
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
          filtro.matchLoja(t.loja_id) &&
          filtro.inPeriodo(t.data_vencimento) &&
          filtro.matchBusca(t.descricao, t.numero_documento, (t as any).fornecedores?.razao_social) &&
          (filtroStatus === "todos" || t.status === filtroStatus) &&
          (filtroOrigem === "todas" || t.origem === filtroOrigem),
      ),
    [titulos, tab, filtroStatus, filtroOrigem, filtro.matchLoja, filtro.inPeriodo, filtro.matchBusca],
  );

  const resumo = useMemo(() => {
    const hoje = hojeISO();
    const em30 = addMeses(hoje, 1);
    let aberto = 0, atrasado = 0, prox30 = 0, pago = 0;
    for (const t of filtrados) {
      if (t.status === "cancelado") continue;
      if (t.status === "pago") { pago += Number(t.valor_pago); continue; }
      const saldo = Number(t.valor) - Number(t.valor_pago);
      aberto += saldo;
      if (t.data_vencimento < hoje) atrasado += saldo;
      else if (t.data_vencimento <= em30) prox30 += saldo;
    }
    return { aberto, atrasado, prox30, pago };
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
            onSubmit={(rows) => criar.mutate(rows)}
          />
        </Dialog>
      }
    >
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="pagar">A pagar</TabsTrigger>
              <TabsTrigger value="receber">A receber</TabsTrigger>
            </TabsList>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Tabs>

        <FiltroBar lojas={lojas as any} state={filtro} buscaPlaceholder="Buscar por descrição, documento ou fornecedor…" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ResumoCard titulo={`Em aberto (${labelTipo})`} valor={resumo.aberto} />
          <ResumoCard titulo="Atrasado" valor={resumo.atrasado} destaque icon={AlertTriangle} />
          <ResumoCard titulo="Vence em 30 dias" valor={resumo.prox30} icon={CalendarClock} />
          <ResumoCard titulo="Baixado" valor={resumo.pago} />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Parc.</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pago em</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                  {!isLoading && filtrados.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nenhum título {labelTipo} neste filtro.</td></tr>
                  )}
                  {filtrados.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">{dBR(t.data_vencimento)}</td>
                      <td className="px-4 py-3">{t.lojas?.nome ?? "—"}</td>
                      <td className="px-4 py-3">
                        {t.descricao}
                        <div className="text-xs text-muted-foreground">
                          {t.fornecedores ? (t.fornecedores.nome_fantasia || t.fornecedores.razao_social) : t.cliente_ref ?? "—"}
                          {t.numero_documento ? ` · Doc ${t.numero_documento}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{ORIGEM_LABEL[t.origem] ?? t.origem}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.numero_parcela}/{t.total_parcelas}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS[t.status]?.variant ?? "outline"}>{STATUS[t.status]?.label ?? t.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{dBR(t.data_pagamento_efetivo)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtBRL(Number(t.valor))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === "pago" ? (
                            <Button variant="ghost" size="sm" onClick={() => estornar.mutate(t)}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />Estornar
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => baixar.mutate(t)}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Baixar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => excluir.mutate(t.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
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
  lojas: { id: string; nome: string; codigo: string; empresa_id: string | null }[];
  fornecedores: { id: string; razao_social: string; nome_fantasia: string | null }[];
  categorias: { id: string; nome: string }[];
  onSubmit: (rows: any[]) => void;
  saving: boolean;
}) {
  const [tipo, setTipo] = useState<"pagar" | "receber">(tipoInicial);
  const [origem, setOrigem] = useState("manual");
  const [lojaId, setLojaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [catId, setCatId] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO());

  const previa = useMemo(() => {
    const n = Math.max(1, Math.round(num(parcelas)));
    const total = Math.round(num(valor) * 100);
    if (!total) return [] as { numero: number; venc: string; valor: number }[];
    const base = Math.floor(total / n);
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      venc: addMeses(primeiroVenc, i),
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
          if (previa.length === 0) return toast.error("Informe o valor");
          const loja = lojas.find((l) => l.id === lojaId);
          const base = {
            tipo,
            origem,
            empresa_id: loja?.empresa_id ?? null,
            loja_id: lojaId,
            fornecedor_id: tipo === "pagar" ? fornecedorId || null : null,
            cliente_ref: tipo === "receber" ? String(fd.get("cliente") || "").trim() || null : null,
            categoria_id: catId || null,
            descricao: String(fd.get("descricao") || "").trim(),
            numero_documento: String(fd.get("doc") || "").trim() || null,
            data_emissao: String(fd.get("emissao") || hojeISO()),
            total_parcelas: previa.length,
            status: "aberto",
          };
          onSubmit(
            previa.map((p) => ({
              ...base,
              numero_parcela: p.numero,
              valor: p.valor,
              data_vencimento: p.venc,
              data_pagamento_previsto: p.venc,
            })),
          );
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
            <Label>Origem *</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
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
          {tipo === "pagar" ? (
            <div>
              <Label>Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Cliente</Label>
              <Input name="cliente" placeholder="Ex.: Operadora de cartão" />
            </div>
          )}
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
                  <span className="text-muted-foreground">{p.numero}/{previa.length} · {dBR(p.venc)}</span>
                  <span className="font-medium">{fmtBRL(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Lançar título"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
