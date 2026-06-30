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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

function PrestadoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prestador | null>(null);
  const [form, setForm] = useState(empty);

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
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
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
    </AppShell>
  );
}
