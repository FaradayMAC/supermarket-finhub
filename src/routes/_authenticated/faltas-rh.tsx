import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  head: () => ({
    meta: [
      { title: "Faltas RH · MercadoGest" },
      { name: "description", content: "Lançamento de faltas por data, com tipo justificada ou injustificada." },
      { property: "og:title", content: "Faltas RH · MercadoGest" },
      { property: "og:description", content: "Lançamento de faltas por data, com tipo justificada ou injustificada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FaltasPage,
});

type Falta = {
  id: string;
  loja_id: string;
  funcionario_id: string;
  data: string;
  tipo: string;
  motivo: string | null;
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

function fmtData(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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
      const { data, error } = await supabase
        .from("faltas_rh")
        .select("id,loja_id,funcionario_id,data,tipo,motivo,observacoes")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Falta[];
    },
  });

  const lojaMap = useMemo(() => new Map(lojas.map((l) => [l.id, l])), [lojas]);
  const funcMap = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  const grupos = useMemo(() => {
    const m = new Map<string, Falta[]>();
    faltas.forEach((f) => {
      const k = f.data.slice(0, 7);
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [faltas]);

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
    onError: (e: any) =>
      toast.error(
        String(e?.message ?? "").includes("duplicate")
          ? "Já existe uma falta lançada para este funcionário nesta data."
          : e.message ?? "Erro ao salvar",
      ),
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
            key={edit?.id ?? "novo"}
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
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Observações</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && faltas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma falta lançada ainda. Clique em "Lançar falta".</td></tr>
              )}
              {grupos.map(([mes, itens]) => (
                <>
                  <tr key={mes} className="border-b bg-muted/20">
                    <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {fmtMes(`${mes}-01`)} · {itens.length} falta(s)
                    </td>
                  </tr>
                  {itens.map((f) => {
                    const loja = lojaMap.get(f.loja_id);
                    const func = funcMap.get(f.funcionario_id);
                    return (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{fmtData(f.data)}</td>
                        <td className="px-4 py-3">{loja ? loja.nome : "—"}</td>
                        <td className="px-4 py-3">{func?.nome ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={f.tipo === "justificada" ? "secondary" : "destructive"}>
                            {f.tipo === "justificada" ? "Justificada" : "Injustificada"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{f.motivo || "—"}</td>
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
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Apenas faltas <strong>injustificadas</strong> geram desconto do dia, perda do DSR da semana
        (Lei 605/49, Art. 6º) e redução proporcional de benefícios no contracheque.
      </p>
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
  const hoje = new Date().toISOString().slice(0, 10);
  const [lojaId, setLojaId] = useState<string>(initial?.loja_id ?? "");
  const [funcId, setFuncId] = useState<string>(initial?.funcionario_id ?? "");
  const [data, setData] = useState<string>(initial?.data?.slice(0, 10) ?? hoje);
  const [tipo, setTipo] = useState<string>(initial?.tipo ?? "injustificada");
  const [motivo, setMotivo] = useState<string>(initial?.motivo ?? "");
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
          if (!data) return toast.error("Informe a data da falta");
          if (tipo === "justificada" && !motivo.trim()) return toast.error("Informe o motivo da justificativa");
          onSubmit({
            loja_id: lojaId,
            funcionario_id: funcId,
            data,
            tipo,
            motivo: motivo.trim() || null,
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
            <Label>Data da falta *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            <p className="mt-1 text-xs text-muted-foreground">Uma falta por funcionário por dia.</p>
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="injustificada">Injustificada</SelectItem>
                <SelectItem value="justificada">Justificada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tipo === "justificada" && (
          <div>
            <Label>Motivo da justificativa *</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: atestado médico" />
          </div>
        )}

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
