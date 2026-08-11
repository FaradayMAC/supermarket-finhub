import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lojas")({
  head: () => ({ meta: [{ title: "Lojas · MercadoGest" }] }),
  component: LojasPage,
});

type Loja = {
  id: string;
  codigo: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  gerente: string | null;
  empresa_id: string | null;
  ativo: boolean;
};

function LojasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Loja | null>(null);

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").order("nome");
      if (error) throw error;
      return data as Loja[];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-regime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, razao_social, regime_tributario")
        .order("razao_social");
      if (error) throw error;
      return data as any as Empresa[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: LojaPayload) => {
      if (edit) {
        const { error } = await supabase.from("lojas").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lojas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Loja atualizada" : "Loja criada");
      qc.invalidateQueries({ queryKey: ["lojas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEdit(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lojas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loja excluída");
      qc.invalidateQueries({ queryKey: ["lojas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <AppShell
      title="Lojas"
      actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Nova loja</Button>
          </DialogTrigger>
          <LojaForm
            initial={edit}
            empresas={empresas}
            onSubmit={(v) => save.mutate(v)}
            saving={save.isPending}
          />
        </Dialog>
      }
    >
      <EmpresasRegime empresas={empresas} />
      <Card>

        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cidade/UF</th>
                <th className="px-4 py-3">Gerente</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && lojas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhuma loja cadastrada. Clique em "Nova loja".</td></tr>
              )}
              {lojas.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.codigo}</td>
                  <td className="px-4 py-3 font-medium">{l.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{[l.cidade, l.estado].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.gerente || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {l.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(l); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir loja "${l.nome}"? Despesas e funcionários vinculados serão removidos.`)) del.mutate(l.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

type LojaPayload = {
  codigo: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  gerente: string | null;
  empresa_id: string | null;
  ativo: boolean;
};

function LojaForm({
  initial,
  empresas,
  onSubmit,
  saving,
}: {
  initial: Loja | null;
  empresas: Empresa[];
  onSubmit: (v: LojaPayload) => void;
  saving: boolean;
}) {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar loja" : "Nova loja"}</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            codigo: String(fd.get("codigo") || "").trim(),
            nome: String(fd.get("nome") || "").trim(),
            cidade: String(fd.get("cidade") || "").trim() || null,
            estado: String(fd.get("estado") || "").trim().toUpperCase() || null,
            gerente: String(fd.get("gerente") || "").trim() || null,
            empresa_id: String(fd.get("empresa_id") || "") || null,
            ativo: fd.get("ativo") === "on",
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="codigo">Código *</Label><Input id="codigo" name="codigo" required maxLength={20} defaultValue={initial?.codigo} placeholder="L001" /></div>
          <div><Label htmlFor="nome">Nome *</Label><Input id="nome" name="nome" required maxLength={120} defaultValue={initial?.nome} placeholder="Unidade Centro" /></div>
          <div><Label htmlFor="cidade">Cidade</Label><Input id="cidade" name="cidade" maxLength={80} defaultValue={initial?.cidade ?? ""} /></div>
          <div><Label htmlFor="estado">UF</Label><Input id="estado" name="estado" maxLength={2} defaultValue={initial?.estado ?? ""} placeholder="SP" /></div>
          <div className="col-span-2">
            <Label htmlFor="empresa_id">Empresa</Label>
            <select
              id="empresa_id"
              name="empresa_id"
              defaultValue={initial?.empresa_id ?? ""}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— Sem empresa —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razao_social}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Define o regime tributário usado nos encargos dos funcionários desta loja.
            </p>
          </div>
          <div className="col-span-2"><Label htmlFor="gerente">Gerente</Label><Input id="gerente" name="gerente" maxLength={120} defaultValue={initial?.gerente ?? ""} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={initial?.ativo ?? true} className="h-4 w-4" /> Loja ativa
        </label>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

type Empresa = { id: string; razao_social: string; regime_tributario: string | null };

/**
 * Regime tributário é um dado da empresa (vale para todas as lojas dela) e
 * define o percentual de encargos patronais de todos os seus funcionários.
 */
function EmpresasRegime({ empresas }: { empresas: Empresa[] }) {
  const qc = useQueryClient();

  const salvar = useMutation({
    mutationFn: async ({ id, regime }: { id: string; regime: string }) => {
      const { error } = await supabase
        .from("empresas")
        .update({ regime_tributario: regime } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regime tributário atualizado");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  if (empresas.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Regime tributário por empresa
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {empresas.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span className="text-sm font-medium">{e.razao_social}</span>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={e.regime_tributario === "lucro_real" ? "lucro_real" : "simples"}
                disabled={salvar.isPending}
                onChange={(ev) => salvar.mutate({ id: e.id, regime: ev.target.value })}
              >
                <option value="simples">Simples Nacional (28% de encargos)</option>
                <option value="lucro_real">Lucro Real / Presumido (68% de encargos)</option>
              </select>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Vale para todas as lojas e funcionários da empresa — não é mais definido por funcionário.
        </p>
      </CardContent>
    </Card>
  );
}
