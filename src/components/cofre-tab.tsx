import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FiltroBarState } from "@/components/filtro-bar";

export type CofreMov = {
  id: string;
  loja_id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: string;
  origem_id: string | null;
  descricao: string | null;
  motivo: string;
  valor: number;
  lojas?: { nome: string; codigo: string } | null;
};

export const ORIGEM_LABEL: Record<string, string> = {
  venda_dinheiro: "Venda em dinheiro",
  folha: "Folha de pagamento",
  despesa: "Despesa",
  deposito_bancario: "Depósito bancário",
  avulso: "Avulso",
};

/** Registra uma saída no cofre. Motivo é sempre obrigatório. */
export async function registrarSaidaCofre(p: {
  loja_id: string;
  data: string;
  origem: "folha" | "despesa" | "deposito_bancario" | "avulso";
  origem_id?: string | null;
  descricao?: string | null;
  motivo: string;
  valor: number;
}) {
  if (!p.motivo?.trim()) throw new Error("Informe o motivo da saída do cofre.");
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("cofre_movimentacoes" as any).insert({
    loja_id: p.loja_id,
    data: p.data,
    tipo: "saida",
    origem: p.origem,
    origem_id: p.origem_id ?? null,
    descricao: p.descricao ?? null,
    motivo: p.motivo.trim(),
    valor: p.valor,
    created_by: userData.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export function CofreTab({
  lojasSelecionadas,
  lojas,
  filtro,
}: {
  lojasSelecionadas: string[];
  lojas: { id: string; nome: string; codigo?: string }[];
  filtro: FiltroBarState;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["cofre-movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_movimentacoes" as any)
        .select("*, lojas(nome, codigo)")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) as CofreMov[];
    },
  });

  const { matchLoja, inPeriodo, matchBusca } = filtro;
  const daLoja = useMemo(() => movs.filter((m) => matchLoja(m.loja_id)), [movs, matchLoja]);

  // Saldo atual = todo o histórico da unidade (não filtrado por período)
  const saldoAtual = daLoja.reduce(
    (s, m) => s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)),
    0,
  );

  const filtradas = useMemo(
    () => daLoja.filter((m) => inPeriodo(m.data) && matchBusca(m.descricao, m.motivo)),
    [daLoja, inPeriodo, matchBusca],
  );

  const entradas = filtradas.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
  const saidas = filtradas.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.valor), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cofre_movimentacoes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["cofre-movs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const criar = useMutation({
    mutationFn: async (p: any) => registrarSaidaCofre(p),
    onSuccess: () => {
      toast.success("Saída do cofre registrada");
      qc.invalidateQueries({ queryKey: ["cofre-movs"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CofreKpi
          icon={<Banknote className="h-4 w-4" />}
          label="Saldo em cofre"
          value={fmtBRL(saldoAtual)}
          accent={saldoAtual < 0 ? "destructive" : "success"}
        />
        <CofreKpi icon={<ArrowUpRight className="h-4 w-4" />} label="Entradas no período" value={fmtBRL(entradas)} accent="success" />
        <CofreKpi icon={<ArrowDownRight className="h-4 w-4" />} label="Saídas no período" value={fmtBRL(saidas)} accent="destructive" />
        <CofreKpi label="Lançamentos" value={String(filtradas.length)} icon={<Banknote className="h-4 w-4" />} />
      </div>

      {saldoAtual < 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Saldo do cofre negativo — há mais saídas registradas do que entradas. Verifique os lançamentos.
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Movimentações do cofre</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={lojas.length === 0}>
                <Plus className="h-4 w-4" /> Nova saída
              </Button>
            </DialogTrigger>
            <SaidaForm
              lojas={lojas}
              lojaPadrao={lojaId !== "todas" ? lojaId : ""}
              saving={criar.isPending}
              onSubmit={(v) => criar.mutate(v)}
            />
          </Dialog>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && filtradas.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Sem movimentações de cofre neste filtro.</td></tr>
              )}
              {filtradas.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">{m.lojas?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.tipo === "entrada" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {m.tipo === "entrada" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ORIGEM_LABEL[m.origem] ?? m.origem}</td>
                  <td className="px-4 py-3">{m.descricao ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.motivo}</td>
                  <td className={`px-4 py-3 text-right font-medium ${m.tipo === "saida" ? "text-destructive" : ""}`}>
                    {m.tipo === "saida" ? "− " : ""}{fmtBRL(Number(m.valor))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.origem !== "venda_dinheiro" && (
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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

function CofreKpi({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent?: "success" | "destructive" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`rounded-md p-2 ${accent === "success" ? "bg-success/15 text-success" : accent === "destructive" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SaidaForm({
  lojas, lojaPadrao, onSubmit, saving,
}: {
  lojas: { id: string; nome: string }[];
  lojaPadrao: string;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [loja, setLoja] = useState(lojaPadrao);
  const [origem, setOrigem] = useState<"deposito_bancario" | "avulso">("deposito_bancario");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nova saída do cofre</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const motivo = String(fd.get("motivo") || "").trim();
          if (!loja) return toast.error("Selecione a loja");
          if (!motivo) return toast.error("O motivo da saída é obrigatório");
          onSubmit({
            loja_id: loja,
            data: String(fd.get("data") || ""),
            origem,
            descricao: String(fd.get("descricao") || "").trim() || null,
            motivo,
            valor: Number(fd.get("valor")),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Loja *</Label>
            <Select value={loja} onValueChange={setLoja}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Tipo de saída *</Label>
            <Select value={origem} onValueChange={(v) => setOrigem(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposito_bancario">Depósito bancário</SelectItem>
                <SelectItem value="avulso">Avulso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="valor">Valor (R$) *</Label>
            <Input id="valor" name="valor" type="number" step="0.01" min="0.01" required />
          </div>
          <div>
            <Label htmlFor="data">Data *</Label>
            <Input id="data" name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" maxLength={200} placeholder="Opcional" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              name="motivo"
              required
              rows={2}
              placeholder={origem === "deposito_bancario" ? "Ex: Depósito Banco X, malote nº Y" : "Descreva o motivo da retirada"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar saída"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
