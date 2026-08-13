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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroBar, useFiltroBar } from "@/components/filtro-bar";
import { Plus, Trash2, Link2, Link2Off, Upload, ArrowDownCircle, ArrowUpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conciliacao")({
  head: () => ({
    meta: [
      { title: "Conciliação bancária · MercadoGest" },
      { name: "description", content: "Importe extratos bancários por loja e concilie cada lançamento com os títulos a pagar e a receber da rede." },
      { property: "og:title", content: "Conciliação bancária · MercadoGest" },
      { property: "og:description", content: "Extratos bancários, casamento automático com títulos e controle do que ainda não foi conciliado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConciliacaoPage,
});

type Extrato = {
  id: string;
  empresa_id: string | null;
  loja_id: string | null;
  conta: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  conciliado: boolean;
  titulo_financeiro_id: string | null;
  observacoes: string | null;
  lojas?: { nome: string; codigo: string } | null;
};

type Titulo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  status: string;
  loja_id: string | null;
  numero_parcela: number;
  total_parcelas: number;
};

const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");
const num = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const diasEntre = (a: string, b: string) =>
  Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

function ConciliacaoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [matchFor, setMatchFor] = useState<Extrato | null>(null);
  const [filtroConta, setFiltroConta] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const filtro = useFiltroBar("mes");
  const { inWindow } = periodoState;

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo, empresa_id").order("nome")).data ?? [],
  });

  const { data: extratos = [], isLoading } = useQuery({
    queryKey: ["extratos-bancarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extratos_bancarios")
        .select("*, lojas(nome, codigo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data as any) as Extrato[];
    },
  });

  const { data: titulos = [] } = useQuery({
    queryKey: ["titulos-para-conciliar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titulos_financeiros")
        .select("id, tipo, descricao, valor, valor_pago, data_vencimento, status, loja_id, numero_parcela, total_parcelas")
        .neq("status", "cancelado")
        .order("data_vencimento", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data as any) as Titulo[];
    },
  });

  const contas = useMemo(
    () => Array.from(new Set(extratos.map((e) => e.conta).filter(Boolean))).sort(),
    [extratos],
  );

  const filtrados = useMemo(
    () =>
      extratos.filter(
        (e) =>
          (filtroLoja === "todas" || e.loja_id === filtroLoja) &&
          (filtroConta === "todas" || e.conta === filtroConta) &&
          (filtroStatus === "todos" ||
            (filtroStatus === "conciliados" ? e.conciliado : !e.conciliado)) &&
          inWindow(e.data),
      ),
    [extratos, filtroLoja, filtroConta, filtroStatus, inWindow],
  );

  const tot = filtrados.reduce(
    (a, e) => {
      const v = Number(e.valor);
      return {
        credito: a.credito + (e.tipo === "credito" ? v : 0),
        debito: a.debito + (e.tipo === "debito" ? v : 0),
        pendentes: a.pendentes + (e.conciliado ? 0 : 1),
        pendenteValor: a.pendenteValor + (e.conciliado ? 0 : v),
      };
    },
    { credito: 0, debito: 0, pendentes: 0, pendenteValor: 0 },
  );
  const saldo = tot.credito - tot.debito;
  const pctConciliado = filtrados.length > 0 ? ((filtrados.length - tot.pendentes) / filtrados.length) * 100 : 0;

  const invalidate = () => qc.invalidateQueries();

  const create = useMutation({
    mutationFn: async (rows: any) => {
      const { error } = await supabase.from("extratos_bancarios").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, vars: any) => {
      toast.success(Array.isArray(vars) ? `${vars.length} lançamentos importados` : "Lançamento registrado");
      invalidate();
      setOpen(false);
      setImportOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const vincular = useMutation({
    mutationFn: async ({ id, titulo_financeiro_id }: { id: string; titulo_financeiro_id: string | null }) => {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ titulo_financeiro_id, conciliado: Boolean(titulo_financeiro_id) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.titulo_financeiro_id ? "Lançamento conciliado" : "Conciliação desfeita");
      invalidate();
      setMatchFor(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const marcarConciliado = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: boolean }) => {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ conciliado: v, ...(v ? {} : { titulo_financeiro_id: null }) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("extratos_bancarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento removido"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const tituloById = useMemo(() => new Map(titulos.map((t) => [t.id, t])), [titulos]);

  return (
    <AppShell
      title="Conciliação bancária"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter state={periodoState} showLabel={false} />
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={lojas.length === 0}>
                <Upload className="h-4 w-4" /> Importar extrato
              </Button>
            </DialogTrigger>
            <ImportForm lojas={lojas as any} onSubmit={(rows) => create.mutate(rows)} saving={create.isPending} />
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Novo lançamento</Button>
            </DialogTrigger>
            <LancamentoForm lojas={lojas as any} onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
          </Dialog>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={filtroLoja} onValueChange={setFiltroLoja}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lojas</SelectItem>
            {(lojas as any[]).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroConta} onValueChange={setFiltroConta}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as contas</SelectItem>
            {contas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendentes">Não conciliados</SelectItem>
            <SelectItem value="conciliados">Conciliados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Créditos" value={fmtBRL(tot.credito)} icon={ArrowDownCircle} />
        <Kpi label="Débitos" value={fmtBRL(tot.debito)} icon={ArrowUpCircle} />
        <Kpi label="Saldo do período" value={fmtBRL(saldo)} />
        <Kpi
          label="Não conciliados"
          value={`${tot.pendentes} · ${fmtBRL(tot.pendenteValor)}`}
          icon={tot.pendentes > 0 ? AlertCircle : CheckCircle2}
        />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Progresso da conciliação</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">
              {filtrados.length - tot.pendentes} de {filtrados.length} lançamentos conciliados
            </span>
            <span className="font-semibold tabular-nums">{pctConciliado.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctConciliado}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum lançamento de extrato no período selecionado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Título vinculado</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => {
                  const t = e.titulo_financeiro_id ? tituloById.get(e.titulo_financeiro_id) : null;
                  return (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{br(e.data)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{e.conta}</td>
                      <td className="px-4 py-3">
                        {e.lojas ? (
                          <>
                            <div className="font-medium">{e.lojas.nome}</div>
                            <div className="text-xs text-muted-foreground">{e.lojas.codigo}</div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">{e.descricao}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${e.tipo === "credito" ? "text-emerald-600" : "text-destructive"}`}>
                        {e.tipo === "credito" ? "+" : "−"} {fmtBRL(Number(e.valor))}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t ? (
                          <div>
                            <div className="font-medium">{t.descricao}</div>
                            <div className="text-muted-foreground">
                              {t.tipo === "pagar" ? "A pagar" : "A receber"} · venc. {br(t.data_vencimento)}
                            </div>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={e.conciliado ? "default" : "outline"}>
                          {e.conciliado ? "Conciliado" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {e.titulo_financeiro_id ? (
                            <Button
                              variant="ghost" size="icon" aria-label="Desfazer conciliação"
                              onClick={() => vincular.mutate({ id: e.id, titulo_financeiro_id: null })}
                            >
                              <Link2Off className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" aria-label="Vincular a título" onClick={() => setMatchFor(e)}>
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => marcarConciliado.mutate({ id: e.id, v: !e.conciliado })}
                              >
                                {e.conciliado ? "Reabrir" : "Conciliar"}
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" aria-label="Remover lançamento" onClick={() => del.mutate(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(matchFor)} onOpenChange={(o) => !o && setMatchFor(null)}>
        {matchFor && (
          <MatchDialog
            extrato={matchFor}
            titulos={titulos}
            onPick={(tid) => vincular.mutate({ id: matchFor.id, titulo_financeiro_id: tid })}
            saving={vincular.isPending}
          />
        )}
      </Dialog>
    </AppShell>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
        </div>
        {Icon && <Icon className="h-5 w-5 text-primary" />}
      </CardContent>
    </Card>
  );
}

function MatchDialog({
  extrato, titulos, onPick, saving,
}: {
  extrato: Extrato;
  titulos: Titulo[];
  onPick: (id: string) => void;
  saving: boolean;
}) {
  const [busca, setBusca] = useState("");
  const esperado = extrato.tipo === "debito" ? "pagar" : "receber";

  const sugeridos = useMemo(() => {
    const valor = Number(extrato.valor);
    return titulos
      .filter((t) => t.tipo === esperado)
      .filter((t) => !busca || t.descricao.toLowerCase().includes(busca.toLowerCase()))
      .map((t) => {
        const dif = Math.abs(Number(t.valor) - valor);
        const dias = diasEntre(t.data_vencimento, extrato.data);
        const mesmaLoja = extrato.loja_id && t.loja_id === extrato.loja_id;
        const score = dif * 10 + dias + (mesmaLoja ? 0 : 30);
        return { t, dif, dias, mesmaLoja, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 15);
  }, [titulos, extrato, esperado, busca]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Conciliar lançamento</DialogTitle>
      </DialogHeader>
      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <div className="font-medium">{extrato.descricao}</div>
        <div className="text-muted-foreground">
          {br(extrato.data)} · {extrato.conta} ·{" "}
          <span className={extrato.tipo === "credito" ? "text-emerald-600" : "text-destructive"}>
            {extrato.tipo === "credito" ? "Crédito" : "Débito"} {fmtBRL(Number(extrato.valor))}
          </span>
        </div>
      </div>
      <Input placeholder="Buscar título pela descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="divide-y rounded-md border">
        {sugeridos.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum título "{esperado === "pagar" ? "a pagar" : "a receber"}" compatível encontrado.
          </div>
        ) : (
          sugeridos.map(({ t, dif, dias, mesmaLoja }) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {t.descricao}
                  {t.total_parcelas > 1 && <span className="text-muted-foreground"> ({t.numero_parcela}/{t.total_parcelas})</span>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Venc. {br(t.data_vencimento)}</span>
                  <span>·</span>
                  <span>{fmtBRL(Number(t.valor))}</span>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  {dif < 0.01 && <Badge className="text-[10px]">valor exato</Badge>}
                  {dias <= 3 && <Badge variant="secondary" className="text-[10px]">data próxima</Badge>}
                  {mesmaLoja && <Badge variant="secondary" className="text-[10px]">mesma loja</Badge>}
                </div>
              </div>
              <Button size="sm" disabled={saving} onClick={() => onPick(t.id)}>Vincular</Button>
            </div>
          ))
        )}
      </div>
    </DialogContent>
  );
}

type Loja = { id: string; nome: string; codigo: string; empresa_id: string | null };

function LancamentoForm({ lojas, onSubmit, saving }: { lojas: Loja[]; onSubmit: (v: any) => void; saving: boolean }) {
  const [f, setF] = useState({
    loja_id: "", conta: "", data: hojeISO(), descricao: "", valor: "", tipo: "debito", observacoes: "",
  });

  const submit = () => {
    if (!f.conta.trim()) return toast.error("Informe a conta bancária");
    if (!f.descricao.trim()) return toast.error("Informe a descrição");
    if (num(f.valor) <= 0) return toast.error("Informe um valor válido");
    const loja = lojas.find((l) => l.id === f.loja_id);
    onSubmit({
      loja_id: f.loja_id || null,
      empresa_id: loja?.empresa_id ?? null,
      conta: f.conta.trim(),
      data: f.data,
      descricao: f.descricao.trim(),
      valor: num(f.valor),
      tipo: f.tipo,
      observacoes: f.observacoes || null,
    });
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Novo lançamento de extrato</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Loja</Label>
          <Select value={f.loja_id} onValueChange={(v) => setF({ ...f, loja_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conta</Label>
          <Input placeholder="Ex.: Itaú 1234-5" value={f.conta} onChange={(e) => setF({ ...f, conta: e.target.value })} />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="credito">Crédito (entrada)</SelectItem>
              <SelectItem value="debito">Débito (saída)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição</Label>
          <Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </div>
        <div>
          <Label>Valor</Label>
          <Input inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ImportForm({ lojas, onSubmit, saving }: { lojas: Loja[]; onSubmit: (rows: any[]) => void; saving: boolean }) {
  const [loja_id, setLoja] = useState("");
  const [conta, setConta] = useState("");
  const [texto, setTexto] = useState("");

  const parsed = useMemo(() => {
    const rows: { data: string; descricao: string; valor: number; tipo: string }[] = [];
    const erros: string[] = [];
    texto.split("\n").map((l) => l.trim()).filter(Boolean).forEach((linha, i) => {
      const p = linha.split(/[;\t]|,(?=\s*[^\d])/).map((x) => x.trim());
      if (p.length < 3) return erros.push(`Linha ${i + 1}: formato inválido`);
      const [dRaw, descricao, vRaw] = p;
      const m = dRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const data = m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(dRaw) ? dRaw : "";
      if (!data) return erros.push(`Linha ${i + 1}: data inválida (${dRaw})`);
      const bruto = num(vRaw.replace(/[R$\s]/g, ""));
      const negativo = /^-/.test(vRaw.trim()) || /^\(.*\)$/.test(vRaw.trim());
      const valor = Math.abs(bruto);
      if (!valor) return erros.push(`Linha ${i + 1}: valor inválido (${vRaw})`);
      rows.push({ data, descricao, valor, tipo: negativo ? "debito" : "credito" });
    });
    return { rows, erros };
  }, [texto]);

  const submit = () => {
    if (!conta.trim()) return toast.error("Informe a conta bancária");
    if (parsed.rows.length === 0) return toast.error("Nenhuma linha válida para importar");
    const loja = lojas.find((l) => l.id === loja_id);
    onSubmit(
      parsed.rows.map((r) => ({
        ...r,
        conta: conta.trim(),
        loja_id: loja_id || null,
        empresa_id: loja?.empresa_id ?? null,
      })),
    );
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Importar extrato (CSV)</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Loja</Label>
          <Select value={loja_id} onValueChange={setLoja}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conta</Label>
          <Input placeholder="Ex.: Itaú 1234-5" value={conta} onChange={(e) => setConta(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Linhas do extrato</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Uma por linha, no formato <code>data;descrição;valor</code>. Valores negativos viram débito.
          </p>
          <Textarea
            rows={10}
            className="font-mono text-xs"
            placeholder={"01/06/2026;Pagamento fornecedor XPTO;-1.250,00\n02/06/2026;Depósito vendas;8.430,55"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
      </div>
      <div className="text-sm">
        <span className="font-medium">{parsed.rows.length}</span> linha(s) válida(s)
        {parsed.erros.length > 0 && (
          <span className="text-destructive"> · {parsed.erros.length} com erro</span>
        )}
        {parsed.erros.slice(0, 3).map((e) => (
          <div key={e} className="text-xs text-destructive">{e}</div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving || parsed.rows.length === 0}>
          {saving ? "Importando…" : `Importar ${parsed.rows.length} lançamentos`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
