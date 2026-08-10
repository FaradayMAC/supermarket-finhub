import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, fmtBRL } from "@/components/app-shell";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adicionaisDoCargo, type Cargo } from "@/lib/cargos";
import { useSalarioMinimo, useSalvarSalarioMinimo } from "@/hooks/use-salario-minimo";
import { calcInss, calcIrrf } from "@/lib/contracheque";

const FGTS_PCT = 0.08;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Bruto do cargo, FGTS (custo empresa), INSS e IRRF descontados e líquido. */
function resumoCargo(bruto: number) {
  const fgts = r2(bruto * FGTS_PCT);
  const inss = calcInss(bruto);
  const irrf = calcIrrf(bruto, inss, 0);
  return { fgts, inss, irrf, liquido: r2(bruto - inss - irrf) };
}



export const Route = createFileRoute("/_authenticated/cargos")({
  head: () => ({
    meta: [
      { title: "Cargos · MercadoGest" },
      { name: "description", content: "Cadastro de cargos com base salarial e adicionais legais." },
      { property: "og:title", content: "Cargos · MercadoGest" },
      { property: "og:description", content: "Base salarial e adicionais por cargo da rede." },
    ],
  }),
  component: CargosPage,
});

function CargosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const { salarioMinimo } = useSalarioMinimo();
  const salvarSm = useSalvarSalarioMinimo();
  const [smEdit, setSmEdit] = useState<string | null>(null);
  const smInput = smEdit ?? String(salarioMinimo);
  const setSmInput = (v: string) => setSmEdit(v);



  const { data: cargos = [], isLoading } = useQuery({
    queryKey: ["cargos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cargos").select("*").order("nome");
      if (error) throw error;
      return data as any as Cargo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ id, ...p }: any) => {
      if (id) {
        const { error } = await supabase.from("cargos").update(p).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cargos").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cargo atualizado" : "Cargo cadastrado");
      qc.invalidateQueries({ queryKey: ["cargos"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cargos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo removido");
      qc.invalidateQueries({ queryKey: ["cargos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <AppShell
      title="Cargos"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Novo cargo
        </Button>
      }
    >
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <CargoForm
          key={editing?.id ?? "new"}
          initial={editing}
          salarioMinimo={salarioMinimo}
          saving={upsert.isPending}
          onSubmit={(v) => upsert.mutate(v)}
        />

      </Dialog>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px]">
            <Label htmlFor="sm">Salário mínimo de referência (R$)</Label>
            <Input
              id="sm"
              type="number"
              min="0"
              step="0.01"
              value={smInput}
              onChange={(e) => setSmInput(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={salvarSm.isPending || Number(smInput) <= 0}
            onClick={() =>
              salvarSm.mutate(Number(smInput), {
                onSuccess: () => toast.success("Salário mínimo atualizado"),
                onError: (e: any) => toast.error(e.message ?? "Erro"),
              })
            }
          >
            {salvarSm.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <p className="flex-1 text-sm text-muted-foreground">
            Base de cálculo da insalubridade e da quebra de caixa em todos os cargos — inclusive os
            já cadastrados. A periculosidade incide sobre o salário base do cargo. Valor atual:{" "}
            <strong>{fmtBRL(salarioMinimo)}</strong>.
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cargo</th>
                
                <th className="px-4 py-3 text-right">Salário base</th>
                <th className="px-4 py-3 text-right">Periculosidade</th>
                <th className="px-4 py-3 text-right">Insalubridade</th>
                <th className="px-4 py-3 text-right">Quebra de caixa</th>
                <th className="px-4 py-3 text-right">FGTS (8%)</th>
                <th className="px-4 py-3 text-right">INSS</th>
                <th className="px-4 py-3 text-right">IRRF</th>
                <th className="px-4 py-3 text-right">Líquido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && cargos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum cargo cadastrado ainda.
                  </td>
                </tr>
              )}
              {cargos.map((c) => {
                const a = adicionaisDoCargo(c, Number(c.salario_base) || 0, salarioMinimo);
                const bruto = (Number(c.salario_base) || 0) + a.total;
                const custo = bruto * (1 + encargosRate("simples"));
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(Number(c.salario_base) || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.tem_periculosidade ? fmtBRL(a.periculosidade) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(c.insalubridade_grau) > 0
                        ? `${fmtBRL(a.insalubridade)} (${Number(c.insalubridade_grau)}%)`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.tem_quebra_caixa ? fmtBRL(a.quebraCaixa) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtBRL(custo)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover o cargo ${c.nome}?`)) del.mutate(c.id);
                        }}
                      >
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

function CargoForm({
  initial,
  onSubmit,
  saving,
  salarioMinimo,
}: {
  initial: Cargo | null;
  onSubmit: (v: any) => void;
  saving: boolean;
  salarioMinimo: number;
}) {
  const [salario, setSalario] = useState<number>(Number(initial?.salario_base ?? 0));
  const [peric, setPeric] = useState<boolean>(Boolean(initial?.tem_periculosidade));
  const [quebra, setQuebra] = useState<boolean>(Boolean(initial?.tem_quebra_caixa));
  const [insalGrau, setInsalGrau] = useState<string>(String(Number(initial?.insalubridade_grau ?? 0)));

  const a = adicionaisDoCargo(
    {
      tem_periculosidade: peric,
      tem_quebra_caixa: quebra,
      insalubridade_grau: Number(insalGrau),
    },
    salario,
    salarioMinimo,
  );

  const bruto = salario + a.total;
  const custo = bruto * (1 + encargosRate("simples"));

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar cargo" : "Novo cargo"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            id: initial?.id,
            nome: String(fd.get("nome") || "").trim(),
            
            salario_base: salario,
            tem_periculosidade: peric,
            tem_quebra_caixa: quebra,
            insalubridade_grau: Number(insalGrau) || 0,
            ativo: true,
          });
        }}
      >
        <div>
          <Label htmlFor="nome">Nome do cargo *</Label>
          <Input id="nome" name="nome" required maxLength={80} defaultValue={initial?.nome ?? ""} />
        </div>
        <div>
          <Label htmlFor="salario">Base salarial (R$) *</Label>
          <Input
            id="salario"
            type="number"
            min="0"
            step="0.01"
            required
            value={salario}
            onChange={(e) => setSalario(Number(e.target.value))}
          />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionais do cargo
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={peric}
              onChange={(e) => setPeric(e.target.checked)}
            />
            Periculosidade — 12% sobre o salário base ({fmtBRL(a.periculosidade)})
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={quebra}
              onChange={(e) => setQuebra(e.target.checked)}
            />
            Quebra de caixa — 22% do salário mínimo ({fmtBRL(a.quebraCaixa)})
          </label>
          <div>
            <Label>Insalubridade (sobre o salário mínimo)</Label>
            <Select value={insalGrau} onValueChange={setInsalGrau}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem insalubridade</SelectItem>
                <SelectItem value="10">Grau médio — 10%</SelectItem>
                <SelectItem value="20">Grau máximo — 20%</SelectItem>
              </SelectContent>
            </Select>
            {Number(insalGrau) > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Valor mensal: {fmtBRL(a.insalubridade)}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="grid grid-cols-2 gap-y-1">
            <div className="text-muted-foreground">Adicionais</div>
            <div className="text-right font-medium">{fmtBRL(a.total)}</div>
            <div className="text-muted-foreground">Remuneração bruta</div>
            <div className="text-right font-medium">{fmtBRL(bruto)}</div>
            <div className="font-semibold">Custo estimado (Simples)</div>
            <div className="text-right font-bold text-primary">{fmtBRL(custo)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
