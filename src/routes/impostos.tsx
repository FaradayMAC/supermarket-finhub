import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CalendarClock, Plus, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/impostos")({
  head: () => ({ meta: [{ title: "Impostos · MercadoGest" }] }),
  component: ImpostosPage,
});

const TIPOS = ["ICMS", "PIS", "COFINS", "IRPJ", "CSLL", "ISS", "INSS", "Outros"] as const;

type Imposto = {
  id: string;
  loja_id: string | null;
  tipo: string;
  descricao: string | null;
  competencia: string;
  base_calculo: number;
  aliquota: number;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  observacoes: string | null;
  lojas?: { nome: string; codigo: string } | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysUntil = (iso: string) => {
  const a = new Date(iso + "T00:00:00");
  const b = new Date(todayISO() + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function ImpostosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Imposto | null>(null);
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });

  const { data: impostos = [], isLoading } = useQuery({
    queryKey: ["impostos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("impostos")
        .select("*, lojas(nome, codigo)")
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Imposto[];
    },
  });

  const filtrados = useMemo(
    () =>
      impostos.filter(
        (i) =>
          (filtroLoja === "todas" || i.loja_id === filtroLoja) &&
          (filtroTipo === "todos" || i.tipo === filtroTipo),
      ),
    [impostos, filtroLoja, filtroTipo],
  );

  const pendentes = filtrados.filter((i) => i.status !== "pago");
  const totalPendente = pendentes.reduce((s, i) => s + Number(i.valor), 0);
  const totalPago = filtrados.filter((i) => i.status === "pago").reduce((s, i) => s + Number(i.valor), 0);

  const vencendo = pendentes
    .filter((i) => i.data_vencimento)
    .map((i) => ({ ...i, dias: daysUntil(i.data_vencimento!) }))
    .filter((i) => i.dias <= 7)
    .sort((a, b) => a.dias - b.dias);

  const vencidos = vencendo.filter((i) => i.dias < 0);
  const proximos = vencendo.filter((i) => i.dias >= 0);

  const upsert = useMutation({
    mutationFn: async (p: any) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("impostos").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("impostos").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Imposto atualizado" : "Imposto cadastrado");
      qc.invalidateQueries({ queryKey: ["impostos"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("impostos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["impostos"] });
    },
  });

  const marcarPago = useMutation({
    mutationFn: async (i: Imposto) => {
      const { error } = await supabase
        .from("impostos")
        .update({ status: "pago", data_pagamento: todayISO() })
        .eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como pago");
      qc.invalidateQueries({ queryKey: ["impostos"] });
    },
  });

  // Calendário: agrupa por mês (próximos 6 meses, incluindo mês atual)
  const calendario = useMemo(() => {
    const meses: { key: string; label: string; itens: Imposto[] }[] = [];
    const base = new Date();
    base.setDate(1);
    for (let m = 0; m < 6; m++) {
      const d = new Date(base.getFullYear(), base.getMonth() + m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      meses.push({
        key,
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        itens: [],
      });
    }
    for (const i of filtrados) {
      if (!i.data_vencimento) continue;
      const key = i.data_vencimento.slice(0, 7);
      const m = meses.find((x) => x.key === key);
      if (m) m.itens.push(i);
    }
    meses.forEach((m) => m.itens.sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "")));
    return meses;
  }, [filtrados]);

  return (
    <AppShell
      title="Impostos"
      actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Novo imposto</Button>
          </DialogTrigger>
          <ImpostoForm
            key={editing?.id ?? "new"}
            lojas={lojas as any}
            initial={editing}
            onSubmit={(v) => upsert.mutate(editing ? { ...v, id: editing.id } : v)}
            saving={upsert.isPending}
          />
        </Dialog>
      }
    >
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pendente</div>
          <div className="mt-1 text-2xl font-semibold">{fmtBRL(totalPendente)}</div>
          <div className="text-xs text-muted-foreground">{pendentes.length} lançamento(s)</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pago</div>
          <div className="mt-1 text-2xl font-semibold text-success">{fmtBRL(totalPago)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Vencendo em 7 dias</div>
          <div className="mt-1 text-2xl font-semibold">{proximos.length}</div>
          <div className="text-xs text-destructive">{vencidos.length} vencido(s)</div>
        </CardContent></Card>
      </div>

      {/* Alertas */}
      {vencidos.length > 0 && (
        <Alert variant="destructive" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{vencidos.length} imposto(s) vencido(s)</AlertTitle>
          <AlertDescription>
            {vencidos.slice(0, 4).map((i) => (
              <div key={i.id} className="text-sm">
                <b>{i.tipo}</b> · {i.lojas?.nome ?? "—"} · venceu em {fmtDate(i.data_vencimento)} · {fmtBRL(Number(i.valor))}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {proximos.length > 0 && (
        <Alert className="mb-4">
          <CalendarClock className="h-4 w-4" />
          <AlertTitle>{proximos.length} vencimento(s) nos próximos 7 dias</AlertTitle>
          <AlertDescription>
            {proximos.slice(0, 4).map((i) => (
              <div key={i.id} className="text-sm">
                <b>{i.tipo}</b> · vence em {i.dias === 0 ? "hoje" : `${i.dias} dia(s)`} ({fmtDate(i.data_vencimento)}) · {fmtBRL(Number(i.valor))}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase text-muted-foreground">Loja:</Label>
          <Select value={filtroLoja} onValueChange={setFiltroLoja}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {(lojas as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase text-muted-foreground">Tipo:</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {lojas.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre uma loja antes de lançar impostos.</CardContent></Card>
      )}

      {/* Calendário de vencimentos */}
      {lojas.length > 0 && (
        <>
          <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Calendário de vencimentos</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {calendario.map((m) => {
              const totalMes = m.itens.reduce((s, i) => s + Number(i.valor), 0);
              return (
                <Card key={m.key}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium capitalize">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{fmtBRL(totalMes)}</div>
                    </div>
                    {m.itens.length === 0 && <div className="text-xs text-muted-foreground">Sem vencimentos</div>}
                    <div className="space-y-1">
                      {m.itens.map((i) => {
                        const d = daysUntil(i.data_vencimento!);
                        const cor = i.status === "pago"
                          ? "text-success"
                          : d < 0 ? "text-destructive" : d <= 7 ? "text-warning-foreground" : "text-foreground";
                        return (
                          <div key={i.id} className="flex items-center justify-between text-sm">
                            <span className={cor}>
                              dia {String(new Date(i.data_vencimento! + "T00:00:00").getDate()).padStart(2, "0")} · <b>{i.tipo}</b>
                            </span>
                            <span className="text-xs text-muted-foreground">{fmtBRL(Number(i.valor))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Loja</th>
                    <th className="px-4 py-3">Competência</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3 text-right">Base</th>
                    <th className="px-4 py-3 text-right">Alíq.</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                  {!isLoading && filtrados.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Sem impostos lançados.</td></tr>
                  )}
                  {filtrados.map((i) => {
                    const d = i.data_vencimento ? daysUntil(i.data_vencimento) : null;
                    const venceCor = i.status === "pago"
                      ? "text-muted-foreground"
                      : d !== null && d < 0 ? "text-destructive font-medium"
                      : d !== null && d <= 7 ? "text-warning-foreground font-medium" : "text-muted-foreground";
                    return (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{i.tipo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{i.lojas?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(i.competencia)}</td>
                        <td className={`px-4 py-3 ${venceCor}`}>{fmtDate(i.data_vencimento)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtBRL(Number(i.base_calculo))}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{Number(i.aliquota).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtBRL(Number(i.valor))}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${i.status === "pago" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"}`}>
                            {i.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {i.status !== "pago" && (
                              <Button size="icon" variant="ghost" title="Marcar como pago" onClick={() => marcarPago.mutate(i)}>
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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
        </>
      )}
    </AppShell>
  );
}

function ImpostoForm({
  lojas, initial, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string }[];
  initial: Imposto | null;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [tipo, setTipo] = useState<string>(initial?.tipo ?? "ICMS");
  const [lojaId, setLojaId] = useState(initial?.loja_id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "pendente");
  const [base, setBase] = useState<number>(Number(initial?.base_calculo ?? 0));
  const [aliq, setAliq] = useState<number>(Number(initial?.aliquota ?? 0));
  const [valor, setValor] = useState<number>(Number(initial?.valor ?? 0));
  const [autoCalc, setAutoCalc] = useState(!initial);

  const valorCalc = autoCalc ? +(base * aliq / 100).toFixed(2) : valor;

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar imposto" : "Novo imposto"}</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!lojaId) return toast.error("Selecione a loja");
          onSubmit({
            tipo,
            loja_id: lojaId,
            descricao: String(fd.get("descricao") || "").trim() || null,
            competencia: String(fd.get("competencia") || ""),
            data_vencimento: String(fd.get("vencimento") || "") || null,
            data_pagamento: String(fd.get("pagamento") || "") || null,
            base_calculo: base,
            aliquota: aliq,
            valor: valorCalc,
            status,
            observacoes: String(fd.get("obs") || "").trim() || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Loja *</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="competencia">Competência *</Label>
            <Input id="competencia" name="competencia" type="date" required defaultValue={initial?.competencia ?? todayISO()} />
          </div>
          <div>
            <Label htmlFor="vencimento">Vencimento</Label>
            <Input id="vencimento" name="vencimento" type="date" defaultValue={initial?.data_vencimento ?? ""} />
          </div>
          <div>
            <Label>Base de cálculo (R$)</Label>
            <Input type="number" step="0.01" min="0" value={base} onChange={(e) => setBase(Number(e.target.value))} />
          </div>
          <div>
            <Label>Alíquota (%)</Label>
            <Input type="number" step="0.01" min="0" value={aliq} onChange={(e) => setAliq(Number(e.target.value))} />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <Label>Valor (R$) *</Label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={autoCalc} onChange={(e) => setAutoCalc(e.target.checked)} />
                Calcular automaticamente (base × alíquota)
              </label>
            </div>
            <Input
              type="number" step="0.01" min="0" required
              value={valorCalc}
              disabled={autoCalc}
              onChange={(e) => setValor(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pagamento">Data de pagamento</Label>
            <Input id="pagamento" name="pagamento" type="date" defaultValue={initial?.data_pagamento ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" maxLength={200} defaultValue={initial?.descricao ?? ""} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Input id="obs" name="obs" maxLength={300} defaultValue={initial?.observacoes ?? ""} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
