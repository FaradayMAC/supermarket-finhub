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
import {
  adicionaisDoCargo,
  MOTIVOS_INSALUBRIDADE,
  PERICULOSIDADE_PCT_PADRAO,
  QUEBRA_CAIXA_PCT,
  type Cargo,
  type MotivoInsalubridade,
} from "@/lib/cargos";
import {
  CHAVE_PISO_ES,
  CHAVE_SM_FEDERAL,
  useReferenciasSalariais,
  useSalvarReferenciaSalarial,
} from "@/hooks/use-referencias-salariais";
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
  const { salarioMinimoFederal, pisoComerciarioEs } = useReferenciasSalariais();
  const salvarRef = useSalvarReferenciaSalarial();
  const [smEdit, setSmEdit] = useState<string | null>(null);
  const [pisoEdit, setPisoEdit] = useState<string | null>(null);
  const smInput = smEdit ?? String(salarioMinimoFederal);
  const pisoInput = pisoEdit ?? String(pisoComerciarioEs);

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

  function salvar(chave: string, valor: number, label: string) {
    salvarRef.mutate(
      { chave, valor },
      {
        onSuccess: () => toast.success(`${label} atualizado`),
        onError: (e: any) => toast.error(e.message ?? "Erro"),
      },
    );
  }

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
          salarioMinimoFederal={salarioMinimoFederal}
          saving={upsert.isPending}
          onSubmit={(v) => upsert.mutate(v)}
        />
      </Dialog>

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <Label htmlFor="sm">Salário mínimo federal (R$)</Label>
            <div className="flex gap-2">
              <Input
                id="sm"
                type="number"
                min="0"
                step="0.01"
                value={smInput}
                onChange={(e) => setSmEdit(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={salvarRef.isPending || Number(smInput) <= 0}
                onClick={() => salvar(CHAVE_SM_FEDERAL, Number(smInput), "Salário mínimo federal")}
              >
                Salvar
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Base de cálculo da <strong>quebra de caixa (22%)</strong> e da{" "}
              <strong>insalubridade (10% ou 20%)</strong> em todos os cargos e funcionários. Valor
              legal de 2026: R$ 1.621,00 (Decreto 12.797/2025).
            </p>
          </div>
          <div>
            <Label htmlFor="piso">Piso salarial do comerciário-ES (R$)</Label>
            <div className="flex gap-2">
              <Input
                id="piso"
                type="number"
                min="0"
                step="0.01"
                value={pisoInput}
                onChange={(e) => setPisoEdit(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={salvarRef.isPending || Number(pisoInput) <= 0}
                onClick={() => salvar(CHAVE_PISO_ES, Number(pisoInput), "Piso do comerciário-ES")}
              >
                Salvar
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Referência informativa (CCT Cláusula 1ª §2º): piso mínimo de contratação por função.{" "}
              <strong>Não entra</strong> no cálculo de nenhum adicional.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Planos de saúde e odontológico — valores da empresa
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Valores únicos para toda a rede, aplicados automaticamente a cada funcionário após{" "}
            <strong>3 meses de admissão (carência)</strong>. O plano de saúde varia pela{" "}
            <strong>faixa etária</strong> na competência calculada.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <CampoConfig
              id="odonto"
              label="Plano odontológico (R$)"
              valor={planoOdonto}
              onChange={setPlanoOdonto}
              onSave={(v) => salvar(CHAVE_PLANO_ODONTO, v, "Plano odontológico")}
              saving={salvarRef.isPending}
              hint="Sem faixa etária — sujeito apenas à carência de 3 meses."
            />
            <CampoConfig
              id="saude1"
              label="Plano de saúde — 18 a 43 anos (R$)"
              valor={planoF1}
              onChange={setPlanoF1}
              onSave={(v) => salvar(CHAVE_PLANO_SAUDE_F1, v, "Plano de saúde (18–43)")}
              saving={salvarRef.isPending}
              hint="Faixa 1 — aplicada a quem tem menos de 44 anos na competência."
            />
            <CampoConfig
              id="saude2"
              label="Plano de saúde — 44 anos ou mais (R$)"
              valor={planoF2}
              onChange={setPlanoF2}
              onSave={(v) => salvar(CHAVE_PLANO_SAUDE_F2, v, "Plano de saúde (44+)")}
              saving={salvarRef.isPending}
              hint="Faixa 2 — passa a valer automaticamente no mês em que o funcionário completa 44 anos."
            />
          </div>
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
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && cargos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum cargo cadastrado ainda.
                  </td>
                </tr>
              )}
              {cargos.map((c) => {
                const a = adicionaisDoCargo(c, Number(c.salario_base) || 0, salarioMinimoFederal);
                const bruto = (Number(c.salario_base) || 0) + a.total;
                const res = resumoCargo(bruto);
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(Number(c.salario_base) || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.tem_periculosidade ? `${fmtBRL(a.periculosidade)} (${a.pericPct}%)` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.grauInsalubridade > 0
                        ? `${fmtBRL(a.insalubridade)} (${a.grauInsalubridade}%)`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.tem_quebra_caixa ? `${fmtBRL(a.quebraCaixa)} (${QUEBRA_CAIXA_PCT}%)` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtBRL(res.fgts)}</td>
                    <td className="px-4 py-3 text-right text-destructive">- {fmtBRL(res.inss)}</td>
                    <td className="px-4 py-3 text-right text-destructive">
                      {res.irrf > 0 ? `- ${fmtBRL(res.irrf)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtBRL(res.liquido)}</td>
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
  salarioMinimoFederal,
}: {
  initial: Cargo | null;
  onSubmit: (v: any) => void;
  saving: boolean;
  salarioMinimoFederal: number;
}) {
  const [salario, setSalario] = useState<number>(Number(initial?.salario_base ?? 0));
  const [peric, setPeric] = useState<boolean>(Boolean(initial?.tem_periculosidade));
  const [pericPct, setPericPct] = useState<number>(
    Number(initial?.periculosidade_pct ?? PERICULOSIDADE_PCT_PADRAO) || PERICULOSIDADE_PCT_PADRAO,
  );
  const [quebra, setQuebra] = useState<boolean>(Boolean(initial?.tem_quebra_caixa));
  const [motivo, setMotivo] = useState<MotivoInsalubridade>(
    (initial?.motivo_insalubridade as MotivoInsalubridade) ?? "nenhum",
  );

  const a = adicionaisDoCargo(
    {
      tem_periculosidade: peric,
      periculosidade_pct: pericPct,
      tem_quebra_caixa: quebra,
      motivo_insalubridade: motivo,
    },
    salario,
    salarioMinimoFederal,
  );

  const bruto = salario + a.total;
  const res = resumoCargo(bruto);

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
            periculosidade_pct: peric ? pericPct : 0,
            tem_quebra_caixa: quebra,
            motivo_insalubridade: motivo,
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
            Periculosidade — % sobre o salário base ({fmtBRL(a.periculosidade)})
          </label>
          {peric && (
            <div className="pl-6">
              <Label htmlFor="pericPct">Percentual de periculosidade (%)</Label>
              <Input
                id="pericPct"
                type="number"
                min="0"
                step="0.01"
                value={pericPct}
                onChange={(e) => setPericPct(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Padrão 30% (motoboy) — CLT Art. 193 §4º, Lei 12.997/2014. Editável por cargo.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={quebra}
              onChange={(e) => setQuebra(e.target.checked)}
            />
            Quebra de caixa — {QUEBRA_CAIXA_PCT}% do salário mínimo federal ({fmtBRL(a.quebraCaixa)})
          </label>
          <p className="pl-6 text-xs text-muted-foreground">
            Percentual fixado pela CCT Fecomércio-ES, Cláusula 4ª — não editável.
          </p>

          <div>
            <Label>Insalubridade — motivo</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoInsalubridade)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOTIVOS_INSALUBRIDADE) as MotivoInsalubridade[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {MOTIVOS_INSALUBRIDADE[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {motivo === "nenhum"
                ? "O grau (10% ou 20% do salário mínimo federal) é definido automaticamente pelo motivo."
                : `${MOTIVOS_INSALUBRIDADE[motivo].fundamento} — ${fmtBRL(a.insalubridade)} por mês.`}
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="grid grid-cols-2 gap-y-1">
            <div className="text-muted-foreground">Adicionais</div>
            <div className="text-right font-medium">{fmtBRL(a.total)}</div>
            <div className="text-muted-foreground">Remuneração bruta</div>
            <div className="text-right font-medium">{fmtBRL(bruto)}</div>
            <div className="text-muted-foreground">FGTS (8%)</div>
            <div className="text-right font-medium">{fmtBRL(res.fgts)}</div>
            <div className="text-muted-foreground">INSS (desconto)</div>
            <div className="text-right font-medium text-destructive">- {fmtBRL(res.inss)}</div>
            <div className="text-muted-foreground">IRRF (desconto)</div>
            <div className="text-right font-medium text-destructive">
              {res.irrf > 0 ? `- ${fmtBRL(res.irrf)}` : "—"}
            </div>
            <div className="font-semibold">Líquido estimado</div>
            <div className="text-right font-bold text-primary">{fmtBRL(res.liquido)}</div>
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
