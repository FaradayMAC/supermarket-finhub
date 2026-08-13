import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";

import { toast } from "sonner";
import { encargosRate } from "@/lib/encargos";
import {
  adicionaisDoCargo,
  MOTIVOS_INSALUBRIDADE,
  PERICULOSIDADE_PCT_PADRAO,
  QUEBRA_CAIXA_PCT,
  type Cargo,
  type MotivoInsalubridade,
} from "@/lib/cargos";
import { custoReal, regimeDoFuncionario, type RegimeTributario } from "@/lib/custo-funcionario";
import { useReferenciasSalariais } from "@/hooks/use-referencias-salariais";
import { dataFimCarencia } from "@/lib/planos";
import { VALE_ALIMENTACAO_PADRAO_ES, VALE_TRANSPORTE_DESCONTO_PCT } from "@/lib/beneficios";
import { TIPOS_RESCISAO } from "@/lib/rescisao";
import { AlertTriangle, Info, UserX } from "lucide-react";
import {
  CORES_SITUACAO,
  fimExperienciaPadrao,
  hojeISO,
  situacaoAtual,
  suspensaoVigente,
  type SituacaoFuncionario,
  type Suspensao,
} from "@/lib/situacao-funcionario";



/** Mantém só os dígitos do CPF (remove pontos/traços). */
function normalizarCpf(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Formata dígitos para a máscara 000.000.000-00 (quando aplicável). */
function fmtCpf(v: string | null | undefined): string {
  const d = normalizarCpf(v ?? "");
  if (d.length !== 11) return v ?? "—";
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

const labelRescisao = (v: string | null | undefined) =>
  TIPOS_RESCISAO.find((t) => t.value === v)?.label ?? "Não informado";

const fmtData = (v?: string | null) =>
  v
    ? new Date(String(v).slice(0, 10) + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "—";


export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários · MercadoGest" }] }),
  component: FuncPage,
});

export { encargosRate, custoReal };


type Func = {
  id: string;
  loja_id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  cargo_id: string | null;
  salario_base: number;
  data_admissao: string | null;
  data_nascimento: string | null;
  data_desligamento: string | null;

  vale_transporte: number;
  vale_alimentacao: number;

  dependentes: number;
  salario_familia: number;
  valor_extra_salarial: number;
  motivo_insalubridade: MotivoInsalubridade;
  tem_periculosidade: boolean;
  periculosidade_pct: number;
  tem_quebra_caixa: boolean;
  desconto_vt: boolean;
  calcula_encargos: boolean;
  situacao: string | null;
  observacoes: string | null;
  ativo: boolean;
  lojas?: {
    nome: string;
    codigo: string;
    empresa_id?: string | null;
    empresas?: { regime_tributario?: string | null } | null;
  };
  cargos?: {
    motivo_insalubridade: MotivoInsalubridade;
    tem_periculosidade: boolean;
    periculosidade_pct: number;
    tem_quebra_caixa: boolean;
  } | null;
};



function FuncPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Func | null>(null);
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");

  const { salarioMinimoFederal, planos: planosCfg } = useReferenciasSalariais();

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-min"],
    queryFn: async () =>
      (await supabase
        .from("lojas")
        .select("id, nome, codigo, empresa_id, empresas(id, razao_social, regime_tributario)")
        .order("nome")).data ?? [],
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["cargos"],
    queryFn: async () =>
      (await supabase.from("cargos").select("*").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: prestadores = [] } = useQuery({
    queryKey: ["prestadores-min"],
    queryFn: async () =>
      (await supabase
        .from("prestadores_servico")
        .select("id, razao_social, nome_fantasia, cnpj")
        .order("razao_social")).data ?? [],
  });



  const { data: funcs = [], isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "*, lojas(nome, codigo, empresa_id, empresas(regime_tributario)), cargos(motivo_insalubridade, tem_periculosidade, periculosidade_pct, tem_quebra_caixa)",
        )
        .order("nome");
      if (error) throw error;
      return data as any as Func[];
    },
  });

  // Situação derivada do Contracheque da competência aberta (mês corrente).
  const mesAberto = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const { data: feriasMes = [] } = useQuery({
    queryKey: ["ferias-competencia", mesAberto],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_gozadas")
        .select("funcionario_id")
        .eq("competencia", `${mesAberto}-01`);
      if (error) throw error;
      return (data ?? []) as { funcionario_id: string }[];
    },
  });

  const { data: afastMes = [] } = useQuery({
    queryKey: ["afastamentos-competencia", mesAberto],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("afastamentos_inss")
        .select("funcionario_id")
        .eq("competencia", `${mesAberto}-01`);
      if (error) throw error;
      return (data ?? []) as { funcionario_id: string }[];
    },
  });

  const { data: suspensoes = [] } = useQuery({
    queryKey: ["suspensoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suspensoes" as any)
        .select("id,funcionario_id,data_inicio,data_fim,motivo");
      if (error) throw error;
      return (data ?? []) as unknown as Suspensao[];
    },
  });

  const hoje = hojeISO();

  const situacaoDe = (f: Func): SituacaoFuncionario => {
    const situacaoMes = afastMes.some((a) => a.funcionario_id === f.id)
      ? "Afastado (INSS)"
      : feriasMes.some((a) => a.funcionario_id === f.id)
        ? "Férias"
        : null;
    const susp = suspensaoVigente(
      suspensoes.filter((s) => s.funcionario_id === f.id),
      hoje,
    );
    return situacaoAtual(f as any, hoje, situacaoMes, susp);
  };



  const filtrados = useMemo(() => {
    const porLoja = filtro === "todas" ? funcs : funcs.filter((f) => f.loja_id === filtro);
    const termo = busca.trim().toLowerCase();
    if (!termo) return porLoja;
    return porLoja.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        (f.cpf ?? "").toLowerCase().includes(termo) ||
        (f.cargo ?? "").toLowerCase().includes(termo) ||
        (f.lojas?.nome ?? "").toLowerCase().includes(termo),
    );
  }, [funcs, filtro, busca]);

  const totalFolha = filtrados.reduce((s, f) => s + custoReal(f, salarioMinimoFederal, planosCfg).total, 0);
  // Casos herdados: recebem VT mas não têm o desconto de 6% ativo — revisão manual.
  const revisaoVt = useMemo(
    () => filtrados.filter((f) => Number(f.vale_transporte) > 0 && !f.desconto_vt),
    [filtrados],
  );

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
        <div className="flex gap-2">
          <Button onClick={openNew} disabled={lojas.length === 0}>
            <Plus className="h-4 w-4" /> Novo funcionário
          </Button>
        </div>
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
          cargos={cargos as any}
          prestadores={prestadores as any}
          initial={editing}
          onSubmit={(v) => upsert.mutate(v)}
          saving={upsert.isPending}
        />



      </Dialog>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
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
          <div className="relative flex-1 min-w-[16rem] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome, CPF, cargo ou unidade"
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Custo real total (filtrado):{" "}
          <span className="font-semibold text-foreground">{fmtBRL(totalFolha)}</span>
        </div>
      </div>


      {revisaoVt.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            <p className="font-semibold">
              Revisão de vale-transporte ({revisaoVt.length})
            </p>
            <p className="mt-1 text-muted-foreground">
              Estes funcionários recebem vale-transporte sem o desconto de 6% aplicado. Edite cada
              cadastro para confirmar a exceção ou ativar o desconto.
            </p>
            <p className="mt-2 text-muted-foreground">
              {revisaoVt.map((f) => f.nome).join(" · ")}
            </p>
          </CardContent>
        </Card>
      )}


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
                  <th className="px-4 py-3">Situação</th>

                  <th className="px-4 py-3">Regime</th>
                  <th className="px-4 py-3 text-center">Dep.</th>
                  <th className="px-4 py-3 text-right">Salário</th>
                  <th className="px-4 py-3 text-right">Sal. família</th>
                  <th className="px-4 py-3 text-right">Prov. férias</th>
                  <th className="px-4 py-3 text-right">Prov. 13º</th>
                  <th className="px-4 py-3 text-right">Adicionais</th>
                  <th className="px-4 py-3 text-right">Benefícios</th>

                  <th className="px-4 py-3 text-right">Encargos</th>
                  <th className="px-4 py-3 text-right">Custo real</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={16} className="px-4 py-12 text-center text-muted-foreground">

                      Sem funcionários neste filtro.
                    </td>
                  </tr>
                )}
                {filtrados.map((f) => {
                  const c = custoReal(f, salarioMinimoFederal, planosCfg);
                  const beneficios = c.beneficios;
                  return (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{f.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtCpf(f.cpf)}</td>

                      <td className="px-4 py-3 text-muted-foreground">{f.cargo ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.lojas?.nome ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${CORES_SITUACAO[situacaoDe(f)]}`}
                        >
                          {situacaoDe(f)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {regimeDoFuncionario(f) === "lucro_real" ? "Lucro Real" : "Simples"}
                      </td>
                      <td className="px-4 py-3 text-center">{f.dependentes ?? 0}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(c.salario)}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(c.sf)}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtBRL(c.provFeriasMes)}
                        <span className="block text-[10px] text-muted-foreground">
                          1/12 + 1/3 no mês
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fmtBRL(c.prov13Mes)}
                        <span className="block text-[10px] text-muted-foreground">
                          1/12 no mês
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {fmtBRL(c.adicionais)}
                        {c.adicionais > 0 && (
                          <span className="ml-1 block text-[10px] text-muted-foreground">
                            {[
                              c.detalheAdicionais.periculosidade > 0 &&
                                `peric. ${c.detalheAdicionais.pericPct}%`,
                              c.detalheAdicionais.insalubridade > 0 &&
                                `insal. ${c.detalheAdicionais.grauInsalubridade}%`,
                              c.detalheAdicionais.quebraCaixa > 0 && `q. caixa ${QUEBRA_CAIXA_PCT}%`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{fmtBRL(beneficios)}</td>

                      <td className="px-4 py-3 text-right">
                        {c.comEncargos ? (
                          <>
                            {fmtBRL(c.encargos)}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({Math.round(c.rate * 100)}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            terceirizado — via prestadora
                          </span>
                        )}
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
  cargos,
  prestadores,
  initial,
  onSubmit,
  saving,
}: {
  lojas: {
    id: string;
    nome: string;
    codigo: string;
    empresa_id?: string | null;
    empresas?: { id: string; razao_social: string; regime_tributario?: string | null } | null;
  }[];
  cargos: Cargo[];
  prestadores: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null }[];
  initial: Func | null;
  onSubmit: (v: any) => void;
  saving: boolean;
}) {

  const [lojaId, setLojaId] = useState(initial?.loja_id ?? "");
  const [cargoId, setCargoId] = useState<string>(initial?.cargo_id ?? "none");

  // CPF controlado para verificar histórico de admissões anteriores.
  const [cpf, setCpf] = useState<string>(initial?.cpf ?? "");
  const [historico, setHistorico] = useState<any[]>([]);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const cpfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cpfTimer.current) clearTimeout(cpfTimer.current);
    const digitos = normalizarCpf(cpf);
    if (digitos.length !== 11) {
      setHistorico([]);
      setBuscandoCpf(false);
      return;
    }
    setBuscandoCpf(true);
    cpfTimer.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id, nome, cargo, loja_id, data_admissao, data_desligamento, motivo_desligamento, observacao_desligamento, lojas(nome)",
        )
        .eq("cpf", digitos)
        .neq("id", initial?.id ?? "00000000-0000-0000-0000-000000000000");
      if (!error && data) setHistorico(data);
      setBuscandoCpf(false);
    }, 500);
    return () => {
      if (cpfTimer.current) clearTimeout(cpfTimer.current);
    };
  }, [cpf, initial?.id]);

  // Registros ativos (sem desligamento) = possível duplicidade de cadastro.
  const ativosCpf = historico.filter((h) => !h.data_desligamento);
  const desligadosCpf = historico.filter((h) => h.data_desligamento);

  const loja = lojas.find((l) => l.id === lojaId) ?? null;
  const empresa = loja?.empresas ?? null;
  const regime: RegimeTributario =
    empresa?.regime_tributario === "lucro_real" ? "lucro_real" : "simples";

  const [salario, setSalario] = useState<number>(Number(initial?.salario_base ?? 0));
  const [vt, setVt] = useState<number>(Number(initial?.vale_transporte ?? 0));
  // Vale-alimentação é fixo por convenção coletiva — não editável no cadastro.
  const va = VALE_ALIMENTACAO_PADRAO_ES;
  const [nascimento, setNascimento] = useState<string>((initial as any)?.data_nascimento ?? "");
  const [admissao, setAdmissao] = useState<string>(initial?.data_admissao ?? "");
  const [motivoDesl, setMotivoDesl] = useState<string>(
    (initial as any)?.motivo_desligamento ?? "none",
  );
  const [dependentes, setDependentes] = useState<number>(Number(initial?.dependentes ?? 0));
  const [ve, setVe] = useState<number>(Number(initial?.valor_extra_salarial ?? 0));
  // Um único controle: possuir VT já implica o desconto de até 6%.
  const [temVt, setTemVt] = useState<boolean>(
    initial ? Number(initial.vale_transporte ?? 0) > 0 : false,
  );
  const [descontoVt, setDescontoVt] = useState<boolean>(initial ? Boolean(initial.desconto_vt) : true);

  const [calculaEncargos, setCalculaEncargos] = useState<boolean>(initial?.calcula_encargos !== false);
  const [prestadorId, setPrestadorId] = useState<string>((initial as any)?.prestador_id ?? "");


  // Cargo selecionado define automaticamente os adicionais legais.
  const { salarioMinimoFederal, planos: planosCfg } = useReferenciasSalariais();
  const cargo = cargos.find((c) => c.id === cargoId) ?? null;

  // Com cargo selecionado, os adicionais pertencem ao cargo — o funcionário
  // não guarda cópia. Sem cargo (avulso), valem os campos do próprio cadastro.
  const adicCfg = cargo
    ? {
        tem_periculosidade: Boolean(cargo.tem_periculosidade),
        periculosidade_pct: Number(cargo.periculosidade_pct ?? PERICULOSIDADE_PCT_PADRAO),
        tem_quebra_caixa: Boolean(cargo.tem_quebra_caixa),
        motivo_insalubridade: (cargo.motivo_insalubridade ?? "nenhum") as MotivoInsalubridade,
      }
    : {
        tem_periculosidade: Boolean(initial?.tem_periculosidade),
        periculosidade_pct: Number(initial?.periculosidade_pct ?? PERICULOSIDADE_PCT_PADRAO),
        tem_quebra_caixa: Boolean(initial?.tem_quebra_caixa),
        motivo_insalubridade: (initial?.motivo_insalubridade ?? "nenhum") as MotivoInsalubridade,
      };
  const adic = adicionaisDoCargo(adicCfg, salario, salarioMinimoFederal);

  function selecionarCargo(id: string) {
    setCargoId(id);
    const c = cargos.find((x) => x.id === id);
    if (c && Number(c.salario_base) > 0) setSalario(Number(c.salario_base));
  }

  const preview = custoReal(
    {
      salario_base: salario,
      vale_transporte: vt,
      vale_alimentacao: va,
      data_admissao: admissao || null,
      data_nascimento: nascimento || null,
      dependentes,
      valor_extra_salarial: ve,
      lojas: { empresas: { regime_tributario: regime } },
      calcula_encargos: calculaEncargos,
      ...adicCfg,
    },
    salarioMinimoFederal,
    planosCfg,
  );



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
          if (!calculaEncargos && !prestadorId)
            return toast.error("Selecione a empresa prestadora de serviços");

          const fd = new FormData(e.currentTarget);
          const sal = Number(fd.get("salario") || 0);
          const _vt = temVt ? Number(fd.get("vt") || 0) : 0;
          if (temVt && _vt <= 0) return toast.error("Informe o valor do vale-transporte");
          const _va = VALE_ALIMENTACAO_PADRAO_ES;
          if (!nascimento) return toast.error("Informe a data de nascimento");
          const _ps = preview.ps;
          const _po = preview.po;
          const _ve = Number(fd.get("ve") || 0);
          onSubmit({
            id: initial?.id,
            loja_id: lojaId,
            cargo_id: cargoId === "none" ? null : cargoId,
            nome: String(fd.get("nome") || "").trim(),
            cpf: normalizarCpf(String(fd.get("cpf") || "")) || null,
            cargo: cargo ? cargo.nome : String(fd.get("cargo") || "").trim() || null,
            salario_base: sal,
            data_admissao: admissao || null,
            data_nascimento: nascimento || null,
            data_desligamento: String(fd.get("desligamento") || "") || null,
            motivo_desligamento: motivoDesl === "none" ? null : motivoDesl,

            vale_transporte: _vt,
            vale_alimentacao: _va,
            plano_saude: _ps,
            plano_odontologico: _po,
            dependentes,
            salario_familia: preview.sf,
            valor_extra_salarial: _ve,
            // Com cargo, os adicionais vivem no cargo — nada é copiado aqui.
            motivo_insalubridade: cargo ? "nenhum" : adicCfg.motivo_insalubridade,
            tem_periculosidade: cargo ? false : adicCfg.tem_periculosidade,
            periculosidade_pct: !cargo && adicCfg.tem_periculosidade ? adicCfg.periculosidade_pct : 0,
            tem_quebra_caixa: cargo ? false : adicCfg.tem_quebra_caixa,
            desconto_vt: temVt && descontoVt,
            calcula_encargos: calculaEncargos,
            prestador_id: calculaEncargos ? null : prestadorId,

            observacoes: String(fd.get("observacoes") || "").trim() || null,
            beneficios: _vt + _va + _ps + _po + _ve,
            ativo: !String(fd.get("desligamento") || ""),

          });


        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Unidade de Trabalho *</Label>
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
            <p className="mt-1 text-xs text-muted-foreground">
              Loja onde o funcionário efetivamente trabalha.
            </p>
          </div>
          <div className="col-span-2 rounded-md border p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vínculo empregatício
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="vinculo"
                  className="h-4 w-4 accent-primary"
                  checked={calculaEncargos}
                  onChange={() => setCalculaEncargos(true)}
                />
                Vínculo direto (CLT)
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="vinculo"
                  className="h-4 w-4 accent-primary"
                  checked={!calculaEncargos}
                  onChange={() => setCalculaEncargos(false)}
                />
                Terceirizado via prestadora
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {calculaEncargos ? (
                <>
                  Encargos patronais aplicados: <strong>{Math.round(encargosRate(regime) * 100)}%</strong>{" "}
                  — regime{" "}
                  <strong>{regime === "lucro_real" ? "Lucro Real / Presumido" : "Simples Nacional"}</strong>{" "}
                  da empresa{empresa ? ` ${empresa.razao_social}` : ""} da unidade selecionada
                  (configurado em Lojas).
                </>
              ) : (
                <>
                  INSS patronal e FGTS são obrigação da prestadora — não entram no custo deste
                  funcionário. O repasse (DAS rateado + retenção de INSS sobre a nota) continua
                  lançado como despesa, no módulo Prestadores.
                </>
              )}
            </p>
            {!calculaEncargos && (
              <div className="mt-3">
                <Label>Empresa prestadora de serviços *</Label>
                <Select value={prestadorId} onValueChange={setPrestadorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prestadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {prestadores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_fantasia || p.razao_social}
                        {p.cnpj ? ` — ${p.cnpj}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Necessário para o rateio do DAS mensal por unidade no módulo Prestadores.
                </p>
              </div>
            )}
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
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                const d = normalizarCpf(e.target.value).slice(0, 11);
                setCpf(
                  d
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4"),
                );
              }}
            />
            {buscandoCpf && (
              <p className="mt-1 text-xs text-muted-foreground">Verificando histórico…</p>
            )}
          </div>
          {historico.length > 0 && (
            <div className="col-span-2 space-y-2">
              {ativosCpf.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                      Este CPF já está cadastrado como funcionário ativo
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Possível duplicidade de cadastro — confirme antes de continuar.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {ativosCpf.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium">{h.nome}</span>
                        <span className="text-muted-foreground">· {h.lojas?.nome ?? "—"}</span>
                        <span className="text-muted-foreground">
                          · admitido em {fmtData(h.data_admissao)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {desligadosCpf.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                      Esse CPF já trabalhou aqui antes
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Histórico de admissões anteriores (em qualquer unidade). A recontratação
                    continua sendo sua decisão — este é apenas um aviso.
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {desligadosCpf.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-col gap-0.5 rounded border bg-background/60 p-2"
                      >
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium">{h.nome}</span>
                          {h.cargo && (
                            <span className="text-muted-foreground">· {h.cargo}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>Loja: {h.lojas?.nome ?? "—"}</span>
                          <span>
                            Período: {fmtData(h.data_admissao)} → {fmtData(h.data_desligamento)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="text-muted-foreground">Desligamento:</span>
                          <span className="font-medium">
                            {labelRescisao(h.motivo_desligamento)}
                          </span>
                          {h.observacao_desligamento && (
                            <span className="text-muted-foreground">
                              · {h.observacao_desligamento}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Cargo</Label>
            {cargos.length > 0 ? (
              <Select value={cargoId} onValueChange={selecionarCargo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem cargo cadastrado —</SelectItem>
                  {cargos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="cargo" name="cargo" maxLength={80} defaultValue={initial?.cargo ?? ""} />
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Cargos são cadastrados na aba Cargos, com base salarial e adicionais.
            </p>
          </div>

          <div>
            <Label htmlFor="nascimento">Data de nascimento *</Label>
            <Input
              id="nascimento"
              name="nascimento"
              type="date"
              required
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Define a faixa etária do plano de saúde (18–43 ou 44+).
            </p>
          </div>
          <div>
            <Label htmlFor="admissao">Data de admissão</Label>
            <Input
              id="admissao"
              name="admissao"
              type="date"
              value={admissao}
              onChange={(e) => setAdmissao(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="desligamento">Data de desligamento</Label>
            <Input
              id="desligamento"
              name="desligamento"
              type="date"
              defaultValue={initial?.data_desligamento ?? ""}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sai das folhas a partir do mês seguinte; competências já fechadas ficam intactas.
            </p>
          </div>
          <div>
            <Label>Motivo do desligamento</Label>
            <Select value={motivoDesl} onValueChange={setMotivoDesl}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TIPOS_RESCISAO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Alimenta o relatório de rotatividade no módulo Rescisão.
            </p>
          </div>
          <div>
            <Label htmlFor="dependentes">Dependentes</Label>
            <Input
              id="dependentes"
              name="dependentes"
              type="number"
              min="0"
              step="1"
              value={dependentes}
              onChange={(e) => setDependentes(Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Base do salário-família e da dedução de IRRF.
            </p>
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
          <div className="col-span-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <input
                id="tem_vt"
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={temVt}
                onChange={(e) => {
                  const on = e.target.checked;
                  setTemVt(on);
                  if (!on) setVt(0);
                  else setDescontoVt(true);
                }}
              />
              <Label htmlFor="tem_vt" className="cursor-pointer">
                Possui vale-transporte
              </Label>
            </div>
            {temVt && (
              <div className="mt-3 space-y-2">
                <div>
                  <Label htmlFor="vt">Valor mensal do vale-transporte (R$) *</Label>
                  <Input
                    id="vt"
                    name="vt"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={vt || ""}
                    onChange={(e) => setVt(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input
                    id="desconto_vt"
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={descontoVt}
                    onChange={(e) => setDescontoVt(e.target.checked)}
                  />
                  <Label htmlFor="desconto_vt" className="cursor-pointer text-xs font-normal text-muted-foreground">
                    Aplicar o desconto legal de {VALE_TRANSPORTE_DESCONTO_PCT}% do salário (Lei 7.418/85).
                    Desmarque apenas na exceção em que a empresa custeia integralmente o benefício.
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="va">Vale alimentação (R$)</Label>
            <Input id="va" name="va" type="number" value={va} readOnly disabled />
            <p className="mt-1 text-xs text-muted-foreground">
              Valor fixo pela CCT Fecomércio-ES 2025-2027 (gêneros alimentícios).
            </p>
          </div>

          <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planos (valores globais — módulo Cargos)
            </div>
            {preview.planos.elegivel ? (
              <div className="grid grid-cols-2 gap-y-1">
                <div className="text-muted-foreground">
                  Plano de saúde{preview.planos.idade !== null ? ` — ${preview.planos.idade} anos` : ""}
                </div>
                <div className="text-right font-medium">{fmtBRL(preview.ps)}</div>
                <div className="text-muted-foreground">Plano odontológico</div>
                <div className="text-right font-medium">{fmtBRL(preview.po)}</div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {admissao
                  ? `Ainda em carência — faltam ${preview.planos.diasParaCarencia} dia(s) (direito a partir de ${
                      dataFimCarencia(admissao)?.toISOString().slice(0, 10).split("-").reverse().join("/") ?? "—"
                    }).`
                  : "Informe a data de admissão para calcular a carência de 3 meses."}
              </p>
            )}
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

          <div className="col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionais legais
            <span className="ml-2 normal-case font-normal">
              {cargo ? (
                <>
                  — pertencem ao cargo <strong>{cargo.nome}</strong>; para alterar, edite em{" "}
                  <Link to="/cargos" className="underline">
                    Cargos
                  </Link>
                </>
              ) : (
                "— selecione um cargo para aplicar os adicionais automaticamente"
              )}
            </span>
          </div>
          <div className="col-span-2 rounded-md border p-3 text-sm">
            <div className="grid gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Periculosidade{" "}
                  {adicCfg.tem_periculosidade
                    ? `(${adicCfg.periculosidade_pct}% do salário base — CLT Art. 193)`
                    : "— não aplicável"}
                </span>
                <span className="font-medium">{fmtBRL(adic.periculosidade)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Insalubridade{" "}
                  {adic.grauInsalubridade > 0
                    ? `(${adic.grauInsalubridade}% do SM federal — ${MOTIVOS_INSALUBRIDADE[adicCfg.motivo_insalubridade].fundamento})`
                    : "— não aplicável"}
                </span>
                <span className="font-medium">{fmtBRL(adic.insalubridade)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Quebra de caixa{" "}
                  {adicCfg.tem_quebra_caixa
                    ? `(${QUEBRA_CAIXA_PCT}% do SM federal — CCT Cláusula 4ª)`
                    : "— não aplicável"}
                </span>
                <span className="font-medium">{fmtBRL(adic.quebraCaixa)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                <span>Total de adicionais</span>
                <span>{fmtBRL(adic.total)}</span>
              </div>
            </div>
          </div>


          <div>
            <Label>Situação</Label>
            <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
              Automática — vem do Contracheque da competência aberta
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Férias ou afastamento pelo INSS marcados no Contracheque definem a situação.
            </p>
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Input
              id="observacoes"
              name="observacoes"
              maxLength={200}
              defaultValue={initial?.observacoes ?? ""}
            />
          </div>
        </div>


        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custo real do funcionário{" "}
            {calculaEncargos
              ? `(${regime === "lucro_real" ? "Lucro Real" : "Simples Nacional"})`
              : "(terceirizado — sem encargos patronais)"}
          </div>
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <div className="text-muted-foreground">Salário</div>
            <div className="text-right font-medium">{fmtBRL(preview.salario)}</div>
            <div className="text-muted-foreground">Adicionais legais</div>
            <div className="text-right font-medium">{fmtBRL(preview.adicionais)}</div>
            <div className="text-muted-foreground">
              {calculaEncargos ? `Encargos (${Math.round(preview.rate * 100)}%)` : "Encargos patronais"}
            </div>
            <div className="text-right font-medium">
              {calculaEncargos ? (
                fmtBRL(preview.encargos)
              ) : (
                <span className="text-xs text-muted-foreground">por conta da prestadora</span>
              )}
            </div>
            <div className="text-muted-foreground">FGTS (estimado, 8%)</div>
            <div className="text-right font-medium">
              {fmtBRL(preview.fgtsEstimado)}
              {calculaEncargos && (
                <span className="ml-1 text-[11px] text-muted-foreground">(já incluso nos encargos)</span>
              )}
            </div>

            <div className="text-muted-foreground">VT + VA + Saúde + Odonto</div>
            <div className="text-right font-medium">
              {fmtBRL(preview.vt + preview.va + preview.ps + preview.po)}
            </div>
            <div className="text-muted-foreground">Salário-família (automático)</div>
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
