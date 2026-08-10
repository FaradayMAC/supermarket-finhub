import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, PieChart, Search, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { parseDasDocument } from "@/lib/das-parse.functions";


export const Route = createFileRoute("/_authenticated/prestadores")({
  component: PrestadoresPage,
});

type Prestador = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  regime_tributario: string;
  anexo_simples: string | null;
  aliquota_das: number;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  observacoes: string | null;
};

type DasRow = {
  id: string;
  prestador_id: string;
  competencia: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
};

const REGIMES = [
  { v: "simples_nacional", l: "Simples Nacional" },
  { v: "lucro_presumido", l: "Lucro Presumido" },
  { v: "lucro_real", l: "Lucro Real" },
  { v: "mei", l: "MEI" },
];
const ANEXOS = ["I", "II", "III", "IV", "V"];

const empty = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  regime_tributario: "simples_nacional",
  anexo_simples: "III",
  aliquota_das: "",
  responsavel: "",
  telefone: "",
  email: "",
  status: "ativa",
  observacoes: "",
};

const BRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtComp = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
};

function PrestadoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prestador | null>(null);
  const [form, setForm] = useState(empty);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const lookupCnpj = async () => {
    const digits = (form.cnpj || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado na Receita");
      const d = await res.json();
      const tel = d.ddd_telefone_1 ? String(d.ddd_telefone_1).replace(/^(\d{2})(\d)/, "($1) $2") : "";
      setForm((f) => ({
        ...f,
        razao_social: d.razao_social || f.razao_social,
        nome_fantasia: d.nome_fantasia || f.nome_fantasia,
        telefone: tel || f.telefone,
        email: (d.email || f.email || "").toLowerCase(),
        regime_tributario: d.opcao_pelo_simples ? "simples_nacional" : f.regime_tributario,
      }));
      toast.success("Dados carregados da Receita Federal");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  };

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["prestadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestadores_servico" as any)
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as unknown as Prestador[];
    },
  });

  const { data: funcCounts = {} } = useQuery({
    queryKey: ["prestadores", "func-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("prestador_id, ativo");
      if (error) throw error;
      const map: Record<string, { total: number; ativos: number }> = {};
      for (const row of (data ?? []) as { prestador_id: string | null; ativo: boolean }[]) {
        if (!row.prestador_id) continue;
        const cur = map[row.prestador_id] ?? { total: 0, ativos: 0 };
        cur.total += 1;
        if (row.ativo) cur.ativos += 1;
        map[row.prestador_id] = cur;
      }
      return map;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.razao_social.trim()) throw new Error("Razão Social é obrigatória");
      const payload = {
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        regime_tributario: form.regime_tributario,
        anexo_simples: form.regime_tributario === "simples_nacional" ? form.anexo_simples : null,
        aliquota_das: Number(form.aliquota_das) || 0,
        responsavel: form.responsavel || null,
        telefone: form.telefone || null,
        email: form.email || null,
        status: form.status,
        observacoes: form.observacoes || null,
      };
      if (editing) {
        const { error } = await supabase.from("prestadores_servico" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prestadores_servico" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores"] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
      toast.success("Prestador salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prestadores_servico" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores"] });
      toast.success("Prestador removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Prestador) {
    setEditing(p);
    setForm({
      razao_social: p.razao_social,
      nome_fantasia: p.nome_fantasia ?? "",
      cnpj: p.cnpj ?? "",
      regime_tributario: p.regime_tributario,
      anexo_simples: p.anexo_simples ?? "III",
      aliquota_das: String(p.aliquota_das ?? ""),
      responsavel: p.responsavel ?? "",
      telefone: p.telefone ?? "",
      email: p.email ?? "",
      status: p.status,
      observacoes: p.observacoes ?? "",
    });
    setOpen(true);
  }

  return (
    <AppShell
      title="Empresas Prestadoras de Serviços"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova prestadora
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar prestadora" : "Nova prestadora"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Razão Social *</Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                    onBlur={() => { if ((form.cnpj || "").replace(/\D/g, "").length === 14 && !form.razao_social) lookupCnpj(); }}
                    placeholder="00.000.000/0000-00"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={lookupCnpj} disabled={cnpjLoading} title="Buscar dados na Receita">
                    {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Regime Tributário</Label>
                <Select value={form.regime_tributario} onValueChange={(v) => setForm({ ...form, regime_tributario: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Anexo do Simples Nacional</Label>
                <Select
                  value={form.anexo_simples}
                  onValueChange={(v) => setForm({ ...form, anexo_simples: v })}
                  disabled={form.regime_tributario !== "simples_nacional"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANEXOS.map((a) => <SelectItem key={a} value={a}>Anexo {a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Alíquota Efetiva do DAS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.aliquota_das}
                  onChange={(e) => setForm({ ...form, aliquota_das: e.target.value })}
                  placeholder="6.00"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs defaultValue="empresas">
        <TabsList>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="das">DAS Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Prestadoras cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : list.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma prestadora cadastrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Razão Social</TableHead>
                        <TableHead>Nome Fantasia</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Regime</TableHead>
                        <TableHead>Anexo</TableHead>
                        <TableHead className="text-right">DAS %</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead className="text-right">Funcionários</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.razao_social}</TableCell>
                          <TableCell>{p.nome_fantasia ?? "—"}</TableCell>
                          <TableCell>{p.cnpj ?? "—"}</TableCell>
                          <TableCell>{REGIMES.find((r) => r.v === p.regime_tributario)?.l ?? p.regime_tributario}</TableCell>
                          <TableCell>{p.anexo_simples ?? "—"}</TableCell>
                          <TableCell className="text-right">{Number(p.aliquota_das).toFixed(2)}%</TableCell>
                          <TableCell>{p.responsavel ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {p.telefone && <div>{p.telefone}</div>}
                            {p.email && <div className="text-muted-foreground">{p.email}</div>}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {(() => {
                              const c = funcCounts[p.id];
                              if (!c) return <span className="text-muted-foreground">0</span>;
                              return (
                                <span>
                                  <span className="font-medium">{c.ativos}</span>
                                  <span className="text-muted-foreground"> / {c.total}</span>
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.status === "ativa" ? "default" : "secondary"}>
                              {p.status === "ativa" ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => { if (confirm(`Remover ${p.razao_social}?`)) del.mutate(p.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="das" className="mt-4">
          <DasSection prestadores={list} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

const dasEmpty = {
  prestador_id: "",
  competencia: new Date().toISOString().slice(0, 7),
  valor: "",
  data_vencimento: "",
  data_pagamento: "",
  observacoes: "",
};

function DasSection({ prestadores }: { prestadores: Prestador[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DasRow | null>(null);
  const [form, setForm] = useState(dasEmpty);
  const [filterPrestador, setFilterPrestador] = useState<string>("all");
  const [reading, setReading] = useState(false);
  const [anexoNome, setAnexoNome] = useState<string | null>(null);
  const parseDas = useServerFn(parseDasDocument);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10MB)"); return; }
    setReading(true);
    setAnexoNome(file.name);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      const fileBase64 = btoa(bin);
      const r = await parseDas({
        data: { filename: file.name, fileBase64, mimeType: file.type || "application/pdf" },
      });
      const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
      const match = r.cnpj ? prestadores.find((p) => digits(p.cnpj) === r.cnpj) : undefined;
      setForm((f) => ({
        ...f,
        prestador_id: match?.id ?? f.prestador_id,
        competencia: r.competencia || f.competencia,
        valor: r.valor_total != null ? String(r.valor_total) : f.valor,
        data_vencimento: r.data_vencimento || f.data_vencimento,
        observacoes: [r.numero_documento ? `Documento nº ${r.numero_documento}` : null, r.observacoes]
          .filter(Boolean)
          .join(" — ") || f.observacoes,
      }));
      if (r.cnpj && !match) toast.warning(`Documento lido, mas nenhuma prestadora com CNPJ ${r.cnpj}. Selecione manualmente.`);
      else toast.success("Documento lido — confira os dados preenchidos.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler o documento");
    } finally {
      setReading(false);
    }
  }


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["prestador-das"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestador_das_mensal" as any)
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DasRow[];
    },
  });

  const prestadorMap = Object.fromEntries(prestadores.map((p) => [p.id, p]));
  const filtered = filterPrestador === "all" ? rows : rows.filter((r) => r.prestador_id === filterPrestador);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.prestador_id) throw new Error("Selecione uma prestadora");
      if (!form.competencia) throw new Error("Informe a competência");
      const payload = {
        prestador_id: form.prestador_id,
        competencia: form.competencia + "-01",
        valor: Number(form.valor) || 0,
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        observacoes: form.observacoes || null,
      };
      if (editing) {
        const { error } = await supabase.from("prestador_das_mensal" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prestador_das_mensal" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestador-das"] });
      setOpen(false);
      setEditing(null);
      setForm(dasEmpty);
      toast.success("DAS salvo");
    },
    onError: (e: any) => {
      const msg = e.message?.includes("duplicate") || e.code === "23505"
        ? "Já existe lançamento para esta prestadora nesta competência"
        : (e.message ?? "Erro ao salvar");
      toast.error(msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prestador_das_mensal" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestador-das"] });
      toast.success("Lançamento removido");
    },
  });

  function openNew() {
    setEditing(null);
    setForm(dasEmpty);
    setOpen(true);
  }
  function openEdit(r: DasRow) {
    setEditing(r);
    setForm({
      prestador_id: r.prestador_id,
      competencia: r.competencia.slice(0, 7),
      valor: String(r.valor ?? ""),
      data_vencimento: r.data_vencimento ?? "",
      data_pagamento: r.data_pagamento ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }

  const total = filtered.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>DAS Mensal</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filterPrestador} onValueChange={setFilterPrestador}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar prestadora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prestadoras</SelectItem>
              {prestadores.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome_fantasia || p.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo DAS</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento de DAS"}</DialogTitle>
              </DialogHeader>
              <div className="rounded-md border border-dashed p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">Anexar documento do DAS</div>
                    <div className="text-muted-foreground text-xs">
                      {anexoNome ? anexoNome : "PDF ou imagem — o app lê e preenche os campos automaticamente."}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" disabled={reading}>
                    <label className="cursor-pointer">
                      {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {reading ? "Lendo..." : "Selecionar arquivo"}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={reading}
                        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
                      />
                    </label>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="sm:col-span-2">
                  <Label>Empresa Prestadora *</Label>
                  <Select value={form.prestador_id} onValueChange={(v) => setForm({ ...form, prestador_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {prestadores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_fantasia || p.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
                </div>
                <div>
                  <Label>Valor do DAS</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                </div>
                <div>
                  <Label>Data de Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </div>
                <div>
                  <Label>Data de Pagamento</Label>
                  <Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                  {editing ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum lançamento de DAS registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Empresa Prestadora</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const p = prestadorMap[r.prestador_id];
                  const pago = !!r.data_pagamento;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{fmtComp(r.competencia)}</TableCell>
                      <TableCell>{p?.nome_fantasia || p?.razao_social || "—"}</TableCell>
                      <TableCell className="text-right">{BRL(Number(r.valor))}</TableCell>
                      <TableCell>{fmtDate(r.data_vencimento)}</TableCell>
                      <TableCell>{fmtDate(r.data_pagamento)}</TableCell>
                      <TableCell>
                        <Badge variant={pago ? "default" : "secondary"}>{pago ? "Pago" : "Em aberto"}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.observacoes ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <RateioButton dasId={r.id} competencia={r.competencia} valor={Number(r.valor)} prestadorNome={p?.nome_fantasia || p?.razao_social || ""} />
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este lançamento?")) del.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="p-2" colSpan={2}>Total ({filtered.length})</td>
                  <td className="p-2 text-right">{BRL(total)}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type RateioRow = {
  id: string;
  loja_id: string;
  folha_unidade: number;
  folha_total: number;
  percentual: number;
  valor_rateado: number;
  lojas?: { nome: string; codigo: string } | null;
};

function RateioButton({ dasId, competencia, valor, prestadorNome }: { dasId: string; competencia: string; valor: number; prestadorNome: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["das-rateio", dasId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestador_das_rateio" as any)
        .select("id, loja_id, folha_unidade, folha_total, percentual, valor_rateado, lojas(nome, codigo)")
        .eq("das_id", dasId)
        .order("valor_rateado", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RateioRow[];
    },
  });
  const totalRateado = data.reduce((s, r) => s + Number(r.valor_rateado || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Ver rateio por unidade">
          <PieChart className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rateio do DAS por Unidade</DialogTitle>
        </DialogHeader>
        <div className="mb-3 text-sm text-muted-foreground">
          {prestadorNome} · Competência {fmtComp(competencia)} · Valor DAS{" "}
          <span className="font-semibold text-foreground">{BRL(valor)}</span>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : data.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum funcionário ativo vinculado a esta empresa prestadora. O rateio é gerado automaticamente quando há folha salarial.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Folha</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Valor rateado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.lojas?.nome ?? "—"}{" "}
                    {r.lojas?.codigo && <span className="text-xs text-muted-foreground">({r.lojas.codigo})</span>}
                  </TableCell>
                  <TableCell className="text-right">{BRL(Number(r.folha_unidade))}</TableCell>
                  <TableCell className="text-right">{Number(r.percentual).toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-semibold">{BRL(Number(r.valor_rateado))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="p-2">Total</td>
                <td className="p-2 text-right">{BRL(data[0] ? Number(data[0].folha_total) : 0)}</td>
                <td className="p-2 text-right">100,00%</td>
                <td className="p-2 text-right">{BRL(totalRateado)}</td>
              </tr>
            </tfoot>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Fórmula: (Folha da Unidade ÷ Folha Total da Empresa) × Valor do DAS. Recalculado
          automaticamente quando há admissão, desligamento, alteração salarial, mudança de
          unidade/prestadora ou alteração do valor do DAS.
        </p>
      </DialogContent>
    </Dialog>
  );
}
