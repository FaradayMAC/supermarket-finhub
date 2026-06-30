import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários · MercadoGest" }] }),
  component: FuncPage,
});

// Encargos patronais por regime tributário.
// - Lucro Real (regime normal CLT): INSS Patronal 20% + RAT/Terceiros ~8,5% + FGTS 8%
//   + provisões de férias+1/3 (~11,11%) e 13º (~8,33%) com encargos sobre elas.
//   Total estimado ≈ 68% do salário.
// - Simples Nacional: INSS Patronal e RAT/Terceiros são recolhidos no DAS
//   (desonerados na folha). Restam FGTS 8% + provisões + FGTS sobre provisões.
//   Total estimado ≈ 28% do salário.
const ENCARGOS_RATE_LUCRO_REAL = 0.68;
const ENCARGOS_RATE_SIMPLES = 0.28;

export function encargosRate(regime: string | null | undefined) {
  return regime === "lucro_real" ? ENCARGOS_RATE_LUCRO_REAL : ENCARGOS_RATE_SIMPLES;
}

type Func = {
  id: string;
  loja_id: string;
  prestador_id: string | null;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  salario_base: number;
  data_admissao: string | null;
  vale_transporte: number;
  vale_alimentacao: number;
  plano_saude: number;
  plano_odontologico: number;
  dependentes: number;
  salario_familia: number;
  valor_extra_salarial: number;
  regime_tributario: "simples" | "lucro_real";
  ativo: boolean;
  lojas?: { nome: string; codigo: string };
  prestadores_servico?: { nome_fantasia: string | null; razao_social: string } | null;
};


export function custoReal(f: {
  salario_base: number | string;
  vale_transporte: number | string;
  vale_alimentacao: number | string;
  plano_saude: number | string;
  plano_odontologico?: number | string;
  salario_familia?: number | string;
  valor_extra_salarial?: number | string;
  regime_tributario?: string | null;
}) {
  const salario = Number(f.salario_base) || 0;
  const vt = Number(f.vale_transporte) || 0;
  const va = Number(f.vale_alimentacao) || 0;
  const ps = Number(f.plano_saude) || 0;
  const po = Number(f.plano_odontologico) || 0;
  const sf = Number(f.salario_familia) || 0;
  const ve = Number(f.valor_extra_salarial) || 0;
  const rate = encargosRate(f.regime_tributario);
  const encargos = salario * rate;
  return { salario, vt, va, ps, po, sf, ve, encargos, rate, total: salario + encargos + vt + va + ps + po + sf + ve };
}

function FuncPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Func | null>(null);
  const [filtro, setFiltro] = useState("todas");

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () =>
      (await supabase.from("lojas").select("id, nome, codigo").order("nome")).data ?? [],
  });

  const { data: prestadores = [] } = useQuery({
    queryKey: ["prestadores-min"],
    queryFn: async () =>
      (await supabase
        .from("prestadores_servico")
        .select("id, razao_social, nome_fantasia, status")
        .order("razao_social")).data ?? [],
  });

  const { data: funcs = [], isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*, lojas(nome, codigo), prestadores_servico(nome_fantasia, razao_social)")
        .order("nome");
      if (error) throw error;
      return data as any as Func[];
    },
  });


  const filtrados = useMemo(
    () => (filtro === "todas" ? funcs : funcs.filter((f) => f.loja_id === filtro)),
    [funcs, filtro],
  );
  const totalFolha = filtrados.reduce((s, f) => s + custoReal(f).total, 0);

  const upsert = useMutation({
    mutationFn: async ({ id, ...p }: any) => {
      if (id) {
        const { error } = await supabase.from("funcionarios").update(p).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("funcionarios").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Funcionário atualizado" : "Funcionário cadastrado");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["funcionarios-calc"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["funcionarios-calc"] });
    },
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(f: Func) {
    setEditing(f);
    setOpen(true);
  }

  return (
    <AppShell
      title="Funcionários"
      actions={
        <Button onClick={openNew} disabled={lojas.length === 0}>
          <Plus className="h-4 w-4" /> Novo funcionário
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
        <FuncForm
          key={editing?.id ?? "new"}
          lojas={lojas as any}
          initial={editing}
          onSubmit={(v) => upsert.mutate(v)}
          saving={upsert.isPending}
        />
      </Dialog>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja:</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {(lojas as any[]).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome} ({l.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          Custo real total (filtrado):{" "}
          <span className="font-semibold text-foreground">{fmtBRL(totalFolha)}</span>
        </div>
      </div>

      {lojas.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cadastre uma loja antes de adicionar funcionários.
          </CardContent>
        </Card>
      )}

      {lojas.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Regime</th>
                  <th className="px-4 py-3 text-center">Dep.</th>
                  <th className="px-4 py-3 text-right">Salário</th>
                  <th className="px-4 py-3 text-right">Sal. família</th>
                  <th className="px-4 py-3 text-right">Benefícios</th>
                  <th className="px-4 py-3 text-right">Encargos</th>
                  <th className="px-4 py-3 text-right">Custo real</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                      Sem funcionários neste filtro.
                    </td>
                  </tr>
                )}
                {filtrados.map((f) => {
                  const c = custoReal(f);
                  const beneficios = c.vt + c.va + c.ps + c.po;
                  return (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{f.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.cpf ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.cargo ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.lojas?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {f.regime_tributario === "lucro_real" ? "Lucro Real" : "Simples"}
                      </td>
                      <td className="px-4 py-3 text-center">{f.dependentes ?? 0}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(c.salario)}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(c.sf)}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(beneficios)}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtBRL(c.encargos)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Math.round(c.rate * 100)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtBRL(c.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remover ${f.nome}?`)) del.mutate(f.id);
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
      )}
    </AppShell>
  );
}

function FuncForm({
  lojas,
  initial,
  onSubmit,
  saving,
}: {
  lojas: { id: string; nome: string; codigo: string }[];
  initial: Func | null;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {
  const [lojaId, setLojaId] = useState(initial?.loja_id ?? "");
  const [regime, setRegime] = useState<"simples" | "lucro_real">(
    (initial?.regime_tributario as any) ?? "simples",
  );
  const [salario, setSalario] = useState<number>(Number(initial?.salario_base ?? 0));
  const [vt, setVt] = useState<number>(Number(initial?.vale_transporte ?? 0));
  const [va, setVa] = useState<number>(Number(initial?.vale_alimentacao ?? 0));
  const [ps, setPs] = useState<number>(Number(initial?.plano_saude ?? 0));
  const [po, setPo] = useState<number>(Number(initial?.plano_odontologico ?? 0));
  const [sf, setSf] = useState<number>(Number(initial?.salario_familia ?? 0));
  const [ve, setVe] = useState<number>(Number(initial?.valor_extra_salarial ?? 0));

  const preview = custoReal({
    salario_base: salario,
    vale_transporte: vt,
    vale_alimentacao: va,
    plano_saude: ps,
    plano_odontologico: po,
    salario_familia: sf,
    valor_extra_salarial: ve,
    regime_tributario: regime,
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!lojaId) return toast.error("Selecione a unidade");
          const fd = new FormData(e.currentTarget);
          const sal = Number(fd.get("salario") || 0);
          const _vt = Number(fd.get("vt") || 0);
          const _va = Number(fd.get("va") || 0);
          const _ps = Number(fd.get("ps") || 0);
          const _po = Number(fd.get("po") || 0);
          const _ve = Number(fd.get("ve") || 0);
          onSubmit({
            id: initial?.id,
            loja_id: lojaId,
            nome: String(fd.get("nome") || "").trim(),
            cpf: String(fd.get("cpf") || "").trim() || null,
            cargo: String(fd.get("cargo") || "").trim() || null,
            salario_base: sal,
            data_admissao: String(fd.get("admissao") || "") || null,
            vale_transporte: _vt,
            vale_alimentacao: _va,
            plano_saude: _ps,
            plano_odontologico: _po,
            dependentes: Number(fd.get("dependentes") || 0),
            salario_familia: Number(fd.get("sf") || 0),
            valor_extra_salarial: _ve,
            regime_tributario: regime,
            encargos: sal * encargosRate(regime),
            beneficios: _vt + _va + _ps + _po + _ve,
            ativo: true,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Unidade *</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {lojas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome} ({l.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Regime tributário da empresa *</Label>
            <Select value={regime} onValueChange={(v) => setRegime(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples Nacional (folha desonerada — ~28%)</SelectItem>
                <SelectItem value="lucro_real">Lucro Real / Presumido (~68%)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Simples Nacional: INSS patronal e RAT/Terceiros recolhidos no DAS. Lucro
              Real/Presumido: encargos completos sobre a folha.
            </p>
          </div>
          <div className="col-span-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" required maxLength={120} defaultValue={initial?.nome ?? ""} />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              maxLength={14}
              placeholder="000.000.000-00"
              defaultValue={initial?.cpf ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" name="cargo" maxLength={80} defaultValue={initial?.cargo ?? ""} />
          </div>
          <div>
            <Label htmlFor="admissao">Data de admissão</Label>
            <Input id="admissao" name="admissao" type="date" defaultValue={initial?.data_admissao ?? ""} />
          </div>
          <div>
            <Label htmlFor="dependentes">Dependentes</Label>
            <Input
              id="dependentes"
              name="dependentes"
              type="number"
              min="0"
              step="1"
              defaultValue={initial?.dependentes ?? 0}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="salario">Salário base (R$) *</Label>
            <Input
              id="salario"
              name="salario"
              type="number"
              min="0"
              step="0.01"
              required
              value={salario}
              onChange={(e) => setSalario(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="vt">Vale transporte (R$)</Label>
            <Input
              id="vt"
              name="vt"
              type="number"
              min="0"
              step="0.01"
              value={vt}
              onChange={(e) => setVt(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="va">Vale alimentação (R$)</Label>
            <Input
              id="va"
              name="va"
              type="number"
              min="0"
              step="0.01"
              value={va}
              onChange={(e) => setVa(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="ps">Plano de saúde (R$)</Label>
            <Input
              id="ps"
              name="ps"
              type="number"
              min="0"
              step="0.01"
              value={ps}
              onChange={(e) => setPs(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="po">Plano odontológico (R$)</Label>
            <Input
              id="po"
              name="po"
              type="number"
              min="0"
              step="0.01"
              value={po}
              onChange={(e) => setPo(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="sf">Salário-família (R$)</Label>
            <Input
              id="sf"
              name="sf"
              type="number"
              min="0"
              step="0.01"
              value={sf}
              onChange={(e) => setSf(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Valor pago ao funcionário por filho elegível (reembolsado pelo INSS).
            </p>
          </div>
          <div>
            <Label htmlFor="ve">Valor extra salarial (R$)</Label>
            <Input
              id="ve"
              name="ve"
              type="number"
              min="0"
              step="0.01"
              value={ve}
              onChange={(e) => setVe(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comissões, gratificações ou outras verbas extras mensais.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custo real do funcionário ({regime === "lucro_real" ? "Lucro Real" : "Simples Nacional"})
          </div>
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <div className="text-muted-foreground">Salário</div>
            <div className="text-right font-medium">{fmtBRL(preview.salario)}</div>
            <div className="text-muted-foreground">
              Encargos ({Math.round(preview.rate * 100)}%)
            </div>
            <div className="text-right font-medium">{fmtBRL(preview.encargos)}</div>
            <div className="text-muted-foreground">VT + VA + Saúde + Odonto</div>
            <div className="text-right font-medium">
              {fmtBRL(preview.vt + preview.va + preview.ps + preview.po)}
            </div>
            <div className="text-muted-foreground">Salário-família</div>
            <div className="text-right font-medium">{fmtBRL(preview.sf)}</div>
            <div className="text-muted-foreground">Extra salarial</div>
            <div className="text-right font-medium">{fmtBRL(preview.ve)}</div>
            <div className="font-semibold">Total</div>
            <div className="text-right font-bold text-primary sm:col-span-3">
              {fmtBRL(preview.total)}
            </div>
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
