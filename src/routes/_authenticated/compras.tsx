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
import { PeriodFilter, usePeriodo } from "@/components/period-filter";
import { Plus, Trash2, PackageSearch, Boxes, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras de mercadoria (CMV) · MercadoGest" },
      { name: "description", content: "Registro de compras de mercadoria por loja e fornecedor, com notas fiscais, itens por produto e apuração do CMV." },
      { property: "og:title", content: "Compras de mercadoria (CMV) · MercadoGest" },
      { property: "og:description", content: "CMV apurado a partir das compras de mercadoria, com fornecedores, notas e itens por produto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComprasPage,
});

type Compra = {
  id: string;
  loja_id: string;
  fornecedor_id: string | null;
  data_compra: string;
  numero_nf: string | null;
  valor_total: number;
  status: string;
  data_pagamento: string | null;
  observacoes: string | null;
  lojas?: { nome: string; codigo: string };
  fornecedores?: { razao_social: string } | null;
};

const STATUS_LABEL: Record<string, string> = { pendente: "Pendente", recebido: "Recebido", pago: "Pago" };
const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default"> = {
  pendente: "outline", recebido: "secondary", pago: "default",
};
const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

function ComprasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Compra | null>(null);
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const periodoState = usePeriodo("1m");
  const { inWindow } = periodoState;

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () => (await supabase.from("lojas").select("id, nome, codigo, empresa_id").order("nome")).data ?? [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").order("razao_social")).data ?? [],
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => (await supabase.from("produtos").select("*").order("nome")).data ?? [],
  });
  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_mercadoria")
        .select("*, lojas(nome, codigo), fornecedores(razao_social)")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return (data as any) as Compra[];
    },
  });

  const filtradas = useMemo(
    () => compras.filter((c) => (filtroLoja === "todas" || c.loja_id === filtroLoja) && inWindow(c.data_compra)),
    [compras, filtroLoja, inWindow],
  );
  const totalCMV = filtradas.reduce((s, c) => s + Number(c.valor_total), 0);
  const pendentes = filtradas.filter((c) => c.status !== "pago");

  const invalidate = () => qc.invalidateQueries();

  const createCompra = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("compras_mercadoria").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Compra registrada"); invalidate(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "pago") patch.data_pagamento = hojeISO();
      const { error } = await supabase.from("compras_mercadoria").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const delCompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras_mercadoria").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Compra removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <AppShell
      title="Compras de mercadoria"
      actions={
        <div className="flex items-center gap-2">
          <PeriodFilter state={periodoState} showLabel={false} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={lojas.length === 0}><Plus className="h-4 w-4" /> Nova compra</Button>
            </DialogTrigger>
            <CompraForm
              lojas={lojas as any}
              fornecedores={fornecedores as any}
              onSubmit={(v) => createCompra.mutate(v)}
              saving={createCompra.isPending}
            />
          </Dialog>
        </div>
      }
    >
      <Tabs defaultValue="compras">
        <TabsList className="mb-4">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="compras">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja:</Label>
              <Select value={filtroLoja} onValueChange={setFiltroLoja}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {(lojas as any[]).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">CMV do período</div>
                <div className="text-lg font-bold tabular-nums">{fmtBRL(totalCMV)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">A pagar</div>
                <div className="text-lg font-bold tabular-nums">
                  {fmtBRL(pendentes.reduce((s, c) => s + Number(c.valor_total), 0))}
                </div>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando…</div>
              ) : filtradas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma compra no período selecionado.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Loja</th>
                      <th className="px-4 py-3">Fornecedor</th>
                      <th className="px-4 py-3">NF</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap">{c.data_compra.split("-").reverse().join("/")}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.lojas?.nome}</div>
                          <div className="text-xs text-muted-foreground">{c.lojas?.codigo}</div>
                        </td>
                        <td className="px-4 py-3">{c.fornecedores?.razao_social ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.numero_nf ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtBRL(Number(c.valor_total))}</td>
                        <td className="px-4 py-3">
                          <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="recebido">Recebido</SelectItem>
                              <SelectItem value="pago">Pago</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => setDetalhe(c)}>
                            <PackageSearch className="h-4 w-4" /> Itens
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => delCompra.mutate(c.id)} aria-label="Remover compra">
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
        </TabsContent>

        <TabsContent value="fornecedores">
          <FornecedoresTab fornecedores={fornecedores as any} onChanged={invalidate} />
        </TabsContent>

        <TabsContent value="produtos">
          <ProdutosTab produtos={produtos as any} onChanged={invalidate} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        {detalhe && <ItensDialog compra={detalhe} produtos={produtos as any} onChanged={invalidate} />}
      </Dialog>
    </AppShell>
  );
}

function CompraForm({
  lojas, fornecedores, onSubmit, saving,
}: {
  lojas: { id: string; nome: string; codigo: string; empresa_id: string | null }[];
  fornecedores: { id: string; razao_social: string }[];
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    loja_id: "", fornecedor_id: "", data_compra: hojeISO(),
    numero_nf: "", valor_total: "", status: "recebido", observacoes: "",
  });

  const submit = () => {
    if (!f.loja_id) return toast.error("Selecione a loja");
    if (num(f.valor_total) <= 0) return toast.error("Informe o valor da compra");
    const loja = lojas.find((l) => l.id === f.loja_id);
    onSubmit({
      loja_id: f.loja_id,
      empresa_id: loja?.empresa_id ?? null,
      fornecedor_id: f.fornecedor_id || null,
      data_compra: f.data_compra,
      numero_nf: f.numero_nf || null,
      valor_total: num(f.valor_total),
      status: f.status,
      data_pagamento: f.status === "pago" ? f.data_compra : null,
      observacoes: f.observacoes || null,
    });
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Nova compra de mercadoria</DialogTitle></DialogHeader>
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
        <div className="sm:col-span-2">
          <Label>Fornecedor</Label>
          <Select value={f.fornecedor_id} onValueChange={(v) => setF({ ...f, fornecedor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              {fornecedores.map((x) => <SelectItem key={x.id} value={x.id}>{x.razao_social}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data da compra</Label>
          <Input type="date" value={f.data_compra} onChange={(e) => setF({ ...f, data_compra: e.target.value })} />
        </div>
        <div>
          <Label>Número da NF</Label>
          <Input value={f.numero_nf} onChange={(e) => setF({ ...f, numero_nf: e.target.value })} />
        </div>
        <div>
          <Label>Valor total</Label>
          <Input inputMode="decimal" placeholder="0,00" value={f.valor_total} onChange={(e) => setF({ ...f, valor_total: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Ao lançar itens por produto, o valor total da compra passa a ser recalculado automaticamente pela soma dos itens.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar compra"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ItensDialog({
  compra, produtos, onChanged,
}: {
  compra: Compra;
  produtos: { id: string; nome: string; sku: string | null; unidade: string }[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [item, setItem] = useState({ produto_id: "", descricao: "", quantidade: "1", valor_unitario: "" });

  const { data: itens = [] } = useQuery({
    queryKey: ["compra-itens", compra.id],
    queryFn: async () =>
      (await supabase
        .from("compras_mercadoria_itens")
        .select("*, produtos(nome, unidade)")
        .eq("compra_id", compra.id)
        .order("created_at")).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["compra-itens", compra.id] });
    onChanged();
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!item.produto_id && !item.descricao) throw new Error("Informe o produto ou uma descrição");
      const { error } = await supabase.from("compras_mercadoria_itens").insert({
        compra_id: compra.id,
        produto_id: item.produto_id || null,
        descricao: item.descricao || null,
        quantidade: num(item.quantidade) || 1,
        valor_unitario: num(item.valor_unitario),
      });
      if (error) throw error;
    },
    onSuccess: () => { setItem({ produto_id: "", descricao: "", quantidade: "1", valor_unitario: "" }); refresh(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras_mercadoria_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const total = (itens as any[]).reduce((s, i) => s + Number(i.valor_total), 0);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          Itens da compra — {compra.lojas?.codigo} · {compra.data_compra.split("-").reverse().join("/")}
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Label>Produto</Label>
          <Select value={item.produto_id} onValueChange={(v) => setItem({ ...item, produto_id: v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descrição</Label>
          <Input value={item.descricao} onChange={(e) => setItem({ ...item, descricao: e.target.value })} />
        </div>
        <div>
          <Label>Qtd.</Label>
          <Input inputMode="decimal" value={item.quantidade} onChange={(e) => setItem({ ...item, quantidade: e.target.value })} />
        </div>
        <div>
          <Label>Valor unit.</Label>
          <Input inputMode="decimal" placeholder="0,00" value={item.valor_unitario} onChange={(e) => setItem({ ...item, valor_unitario: e.target.value })} />
        </div>
      </div>
      <Button size="sm" className="w-fit" onClick={() => add.mutate()} disabled={add.isPending}>
        <Plus className="h-4 w-4" /> Adicionar item
      </Button>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Qtd.</th>
              <th className="px-3 py-2 text-right">Unit.</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(itens as any[]).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem itens — o valor total informado na compra é usado no CMV.</td></tr>
            )}
            {(itens as any[]).map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="px-3 py-2">{i.produtos?.nome ?? i.descricao ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(i.quantidade)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(i.valor_unitario))}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtBRL(Number(i.valor_total))}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)} aria-label="Remover item">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
        <span className="text-sm text-muted-foreground">Total dos itens</span>
        <span className="text-lg font-bold tabular-nums">{fmtBRL(total)}</span>
      </div>
    </DialogContent>
  );
}

function FornecedoresTab({ fornecedores, onChanged }: { fornecedores: any[]; onChanged: () => void }) {
  const [f, setF] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", email: "" });

  const add = useMutation({
    mutationFn: async () => {
      if (!f.razao_social.trim()) throw new Error("Informe a razão social");
      const { error } = await supabase.from("fornecedores").insert({
        razao_social: f.razao_social.trim(),
        nome_fantasia: f.nome_fantasia || null,
        cnpj: f.cnpj || null,
        telefone: f.telefone || null,
        email: f.email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fornecedor cadastrado"); setF({ razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", email: "" }); onChanged(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-primary" /> Novo fornecedor</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <Input placeholder="Razão social" value={f.razao_social} onChange={(e) => setF({ ...f, razao_social: e.target.value })} />
          <Input placeholder="Nome fantasia" value={f.nome_fantasia} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} />
          <Input placeholder="CNPJ" value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} />
          <Input placeholder="Telefone" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4" /> Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {fornecedores.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
              )}
              {fornecedores.map((x) => (
                <tr key={x.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{x.razao_social}</div>
                    {x.nome_fantasia && <div className="text-xs text-muted-foreground">{x.nome_fantasia}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{x.cnpj ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{x.telefone ?? x.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(x.id)} aria-label="Remover fornecedor">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProdutosTab({ produtos, onChanged }: { produtos: any[]; onChanged: () => void }) {
  const [p, setP] = useState({ sku: "", nome: "", categoria_produto: "", unidade: "UN" });

  const add = useMutation({
    mutationFn: async () => {
      if (!p.nome.trim()) throw new Error("Informe o nome do produto");
      const { error } = await supabase.from("produtos").insert({
        sku: p.sku || null,
        nome: p.nome.trim(),
        categoria_produto: p.categoria_produto || null,
        unidade: p.unidade || "UN",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto cadastrado"); setP({ sku: "", nome: "", categoria_produto: "", unidade: "UN" }); onChanged(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4 text-primary" /> Novo produto</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <Input placeholder="SKU" value={p.sku} onChange={(e) => setP({ ...p, sku: e.target.value })} />
          <Input placeholder="Nome" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} />
          <Input placeholder="Categoria" value={p.categoria_produto} onChange={(e) => setP({ ...p, categoria_produto: e.target.value })} />
          <Input placeholder="Unidade (UN, KG…)" value={p.unidade} onChange={(e) => setP({ ...p, unidade: e.target.value })} />
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4" /> Adicionar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {produtos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado (opcional).</td></tr>
              )}
              {produtos.map((x) => (
                <tr key={x.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{x.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{x.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{x.categoria_produto ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{x.unidade}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(x.id)} aria-label="Remover produto">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
