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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroBar, useFiltroBar } from "@/components/filtro-bar";
import { Plus, Trash2, ShoppingCart, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas diárias · MercadoGest" },
      { name: "description", content: "Lançamento e conferência do faturamento diário por loja, com quebra por forma de recebimento e ticket médio." },
      { property: "og:title", content: "Vendas diárias · MercadoGest" },
      { property: "og:description", content: "Faturamento diário por loja com formas de recebimento, cupons e conferência de caixa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VendasPage,
});

type Venda = {
  id: string;
  loja_id: string;
  data: string;
  valor_dinheiro: number;
  valor_pix: number;
  valor_cartao_debito: number;
  valor_cartao_credito: number;
  valor_outros: number;
  valor_total: number;
  qtd_cupons: number;
  fonte: string;
  conferido_caixa: boolean;
  observacoes: string | null;
  lojas?: { nome: string; codigo: string };
};

const FONTE_LABEL: Record<string, string> = {
  manual: "Manual",
  importado_planilha: "Planilha",
  integracao_pdv: "PDV",
};

const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function VendasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const filtro = useFiltroBar("mes");
  const { matchLoja, inPeriodo } = filtro;

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo, empresa_id").order("nome")).data ?? [],
  });

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas-diarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_diarias")
        .select("*, lojas(nome, codigo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data as any) as Venda[];
    },
  });

  const filtradas = useMemo(
    () =>
      vendas.filter((v) => matchLoja(v.loja_id) && inPeriodo(v.data)),
    [vendas, matchLoja, inPeriodo],
  );

  const tot = filtradas.reduce(
    (a, v) => ({
      total: a.total + Number(v.valor_total),
      dinheiro: a.dinheiro + Number(v.valor_dinheiro),
      pix: a.pix + Number(v.valor_pix),
      debito: a.debito + Number(v.valor_cartao_debito),
      credito: a.credito + Number(v.valor_cartao_credito),
      outros: a.outros + Number(v.valor_outros),
      cupons: a.cupons + Number(v.qtd_cupons ?? 0),
      naoConferidos: a.naoConferidos + (v.conferido_caixa ? 0 : 1),
    }),
    { total: 0, dinheiro: 0, pix: 0, debito: 0, credito: 0, outros: 0, cupons: 0, naoConferidos: 0 },
  );
  const ticket = tot.cupons > 0 ? tot.total / tot.cupons : 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendas-diarias"] });
    qc.invalidateQueries();
  };

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("vendas_diarias").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda registrada");
      invalidate();
      setOpen(false);
    },
    onError: (e: any) =>
      toast.error(
        e.message?.includes("duplicate") || e.code === "23505"
          ? "Já existe venda lançada para esta loja nesta data."
          : e.message ?? "Erro",
      ),
  });

  const toggleConf = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: boolean }) => {
      const { error } = await supabase.from("vendas_diarias").update({ conferido_caixa: v }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas_diarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <AppShell
      title="Vendas diárias"
      actions={
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Nova venda</Button>
            </DialogTrigger>
            <VendaForm lojas={lojas as any} onSubmit={(v) => create.mutate(v)} saving={create.isPending} />
          </Dialog>
        </div>
      }
    >
      <div className="mb-4">
        <FiltroBar lojas={lojas as any} state={filtro} busca={false} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Faturamento" value={fmtBRL(tot.total)} icon={ShoppingCart} />
        <Kpi label="Cupons" value={tot.cupons.toLocaleString("pt-BR")} />
        <Kpi label="Ticket médio" value={tot.cupons > 0 ? fmtBRL(ticket) : "—"} />
        <Kpi
          label="Pendentes de conferência"
          value={String(tot.naoConferidos)}
          icon={tot.naoConferidos > 0 ? AlertCircle : CheckCircle2}
        />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Composição por forma de recebimento</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {[
            ["Dinheiro", tot.dinheiro], ["Pix", tot.pix], ["Débito", tot.debito],
            ["Crédito", tot.credito], ["Outros", tot.outros],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{fmtBRL(Number(val))}</div>
              <div className="text-xs text-muted-foreground">
                {tot.total > 0 ? `${((Number(val) / tot.total) * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma venda no período selecionado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Loja</th>
                  <th className="px-4 py-3 text-right">Dinheiro</th>
                  <th className="px-4 py-3 text-right">Pix</th>
                  <th className="px-4 py-3 text-right">Débito</th>
                  <th className="px-4 py-3 text-right">Crédito</th>
                  <th className="px-4 py-3 text-right">Outros</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Cupons</th>
                  <th className="px-4 py-3 text-right">Ticket</th>
                  <th className="px-4 py-3">Fonte</th>
                  <th className="px-4 py-3 text-center">Conferido</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{v.data.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.lojas?.nome}</div>
                      <div className="text-xs text-muted-foreground">{v.lojas?.codigo}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(Number(v.valor_dinheiro))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(Number(v.valor_pix))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(Number(v.valor_cartao_debito))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(Number(v.valor_cartao_credito))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtBRL(Number(v.valor_outros))}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtBRL(Number(v.valor_total))}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.qtd_cupons || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {v.qtd_cupons > 0 ? fmtBRL(Number(v.valor_total) / v.qtd_cupons) : "—"}
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{FONTE_LABEL[v.fonte] ?? v.fonte}</Badge></td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={v.conferido_caixa}
                        onCheckedChange={(c) => toggleConf.mutate({ id: v.id, v: Boolean(c) })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(v.id)} aria-label="Remover venda">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        </div>
        {Icon && <Icon className="h-5 w-5 text-primary" />}
      </CardContent>
    </Card>
  );
}

function VendaForm({
  lojas, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string; empresa_id: string | null }[];
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    loja_id: "",
    data: hojeISO(),
    valor_dinheiro: "",
    valor_pix: "",
    valor_cartao_debito: "",
    valor_cartao_credito: "",
    valor_outros: "",
    qtd_cupons: "",
    fonte: "manual",
    conferido_caixa: false,
    observacoes: "",
  });
  const num = (v: string) => Number(String(v).replace(",", ".")) || 0;
  const total =
    num(f.valor_dinheiro) + num(f.valor_pix) + num(f.valor_cartao_debito) +
    num(f.valor_cartao_credito) + num(f.valor_outros);

  const submit = () => {
    if (!f.loja_id) return toast.error("Selecione a loja");
    if (total <= 0) return toast.error("Informe ao menos um valor de recebimento");
    const loja = lojas.find((l) => l.id === f.loja_id);
    onSubmit({
      loja_id: f.loja_id,
      empresa_id: loja?.empresa_id ?? null,
      data: f.data,
      valor_dinheiro: num(f.valor_dinheiro),
      valor_pix: num(f.valor_pix),
      valor_cartao_debito: num(f.valor_cartao_debito),
      valor_cartao_credito: num(f.valor_cartao_credito),
      valor_outros: num(f.valor_outros),
      qtd_cupons: Number(f.qtd_cupons) || 0,
      fonte: f.fonte,
      conferido_caixa: f.conferido_caixa,
      observacoes: f.observacoes || null,
    });
  };

  const money = (key: keyof typeof f, label: string) => (
    <div>
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        placeholder="0,00"
        value={f[key] as string}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Nova venda diária</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Loja</Label>
          <Select value={f.loja_id} onValueChange={(v) => setF({ ...f, loja_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </div>
        <div>
          <Label>Qtd. de cupons</Label>
          <Input inputMode="numeric" placeholder="0" value={f.qtd_cupons} onChange={(e) => setF({ ...f, qtd_cupons: e.target.value })} />
        </div>
        {money("valor_dinheiro", "Dinheiro")}
        {money("valor_pix", "Pix")}
        {money("valor_cartao_debito", "Cartão débito")}
        {money("valor_cartao_credito", "Cartão crédito")}
        {money("valor_outros", "Outros")}
        <div>
          <Label>Fonte</Label>
          <Select value={f.fonte} onValueChange={(v) => setF({ ...f, fonte: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="importado_planilha">Importado de planilha</SelectItem>
              <SelectItem value="integracao_pdv">Integração PDV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={f.conferido_caixa} onCheckedChange={(c) => setF({ ...f, conferido_caixa: Boolean(c) })} />
          Conferido com o caixa físico
        </label>
        <div className="rounded-md border bg-muted/30 px-4 py-3 sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total do dia</div>
          <div className="text-xl font-bold tabular-nums">{fmtBRL(total)}</div>
          {Number(f.qtd_cupons) > 0 && (
            <div className="text-xs text-muted-foreground">
              Ticket médio: {fmtBRL(total / Number(f.qtd_cupons))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar venda"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
