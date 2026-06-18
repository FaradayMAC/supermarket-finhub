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

export const Route = createFileRoute("/lojas")({
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

  const save = useMutation({
    mutationFn: async (payload: Partial<Loja>) => {
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
            onSubmit={(v) => save.mutate(v)}
            saving={save.isPending}
          />
        </Dialog>
      }
    >
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

function LojaForm({ initial, onSubmit, saving }: { initial: Loja | null; onSubmit: (v: Partial<Loja>) => void; saving: boolean }) {
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
            ativo: fd.get("ativo") === "on",
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="codigo">Código *</Label><Input id="codigo" name="codigo" required maxLength={20} defaultValue={initial?.codigo} placeholder="L001" /></div>
          <div><Label htmlFor="nome">Nome *</Label><Input id="nome" name="nome" required maxLength={120} defaultValue={initial?.nome} placeholder="Unidade Centro" /></div>
          <div><Label htmlFor="cidade">Cidade</Label><Input id="cidade" name="cidade" maxLength={80} defaultValue={initial?.cidade ?? ""} /></div>
          <div><Label htmlFor="estado">UF</Label><Input id="estado" name="estado" maxLength={2} defaultValue={initial?.estado ?? ""} placeholder="SP" /></div>
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
