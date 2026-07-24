import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/faltas-rh")({
  head: () => ({ meta: [{ title: "Faltas RH · MercadoGest" }] }),
  component: FaltasPage,
});

type Falta = {
  id: string;
  loja_id: string;
  funcionario_id: string;
  quantidade: number;
  mes_referencia: string;
  observacoes: string | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtMes(iso: string) {
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]}/${y}`;
}

function FaltasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Falta | null>(null);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id,nome,codigo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; codigo: string }[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id,nome,loja_id").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; loja_id: string }[];
    },
  });

  const { data: faltas = [], isLoading } = useQuery({
    queryKey: ["faltas-rh"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faltas_rh").select("*").order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data as Falta[];
    },
  });

  const lojaMap = useMemo(() => new Map(lojas.map((l) => [l.id, l])), [lojas]);
  const funcMap = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  const save = useMutation({
    mutationFn: async (payload: Omit<Falta, "id">) => {
      if (edit) {
        const { error } = await supabase.from("faltas_rh").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("faltas_rh").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(edit ? "Falta atualizada" : "Falta lançada");
      qc.invalidateQueries({ queryKey: ["faltas-rh"] });
      setOpen(false);
      setEdit(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faltas_rh").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Falta excluída");
      qc.invalidateQueries({ queryKey: ["faltas-rh"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <AppShell
      title="Faltas RH"
      actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Lançar falta</Button>
          </DialogTrigger>
          <FaltaForm
            initial={edit}
            lojas={lojas}
            funcionarios={funcionarios}
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
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3 text-center">Faltas</th>
                <th className="px-4 py-3">Observações</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && faltas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhuma falta lançada ainda. Clique em "Lançar falta".</td></tr>
              )}
              {faltas.map((f) => {
                const loja = lojaMap.get(f.loja_id);
                const func = funcMap.get(f.funcionario_id);
                return (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{fmtMes(f.mes_referencia)}</td>
                    <td className="px-4 py-3">{loja ? `${loja.nome}` : "—"}</td>
                    <td className="px-4 py-3">{func?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-center font-semibold">{f.quantidade}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.observacoes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEdit(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir este lançamento?")) del.mutate(f.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function FaltaForm({
  initial,
  lojas,
  funcionarios,
  onSubmit,
  saving,
}: {
  initial: Falta | null;
  lojas: { id: string; nome: string; codigo: string }[];
  funcionarios: { id: string; nome: string; loja_id: string }[];
  onSubmit: (v: Omit<Falta, "id">) => void;
  saving: boolean;
}) {
  const now = new Date();
  const defaultMes = initial?.mes_referencia?.slice(0, 7) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [lojaId, setLojaId] = useState<string>(initial?.loja_id ?? "");
  const [funcId, setFuncId] = useState<string>(initial?.funcionario_id ?? "");
  const [qtd, setQtd] = useState<number>(initial?.quantidade ?? 1);
  const [mes, setMes] = useState<string>(defaultMes);
  const [obs, setObs] = useState<string>(initial?.observacoes ?? "");

  const funcsFiltrados = useMemo(
    () => funcionarios.filter((f) => f.loja_id === lojaId),
    [funcionarios, lojaId],
  );

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar falta" : "Lançar falta"}</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!lojaId) return toast.error("Selecione a loja");
          if (!funcId) return toast.error("Selecione o funcionário");
          if (qtd < 1 || qtd > 31) return toast.error("Quantidade deve estar entre 1 e 31");
          if (!mes) return toast.error("Informe o mês referente");
          onSubmit({
            loja_id: lojaId,
            funcionario_id: funcId,
            quantidade: qtd,
            mes_referencia: `${mes}-01`,
            observacoes: obs.trim() || null,
          });
        }}
      >
        <div>
          <Label>Selecionar loja *</Label>
          <Select value={lojaId} onValueChange={(v) => { setLojaId(v); setFuncId(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nome} ({l.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Selecionar funcionário *</Label>
          <Select value={funcId} onValueChange={setFuncId} disabled={!lojaId}>
            <SelectTrigger>
              <SelectValue placeholder={lojaId ? (funcsFiltrados.length ? "Selecione o funcionário" : "Nenhum funcionário ativo nesta loja") : "Selecione a loja primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {funcsFiltrados.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade de faltas *</Label>
            <Input
              type="number"
              min={1}
              max={31}
              step={1}
              value={qtd}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isNaN(v)) return;
                setQtd(Math.max(1, Math.min(31, Math.floor(v))));
              }}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Máximo de 31 por mês.</p>
          </div>
          <div>
            <Label>Mês referente *</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
