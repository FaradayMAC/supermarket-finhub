import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  diasPagosEmpresa,
  fimEstabilidadeAcidente,
  situacaoAcidente,
  type AtestadoAcidente,
} from "@/lib/situacao-funcionario";

const fmtData = (v?: string | null) =>
  v
    ? new Date(String(v).slice(0, 10) + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "—";

export function useAtestadosAcidente() {
  return useQuery({
    queryKey: ["atestados-acidente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atestados_acidente_trabalho" as any)
        .select("id,funcionario_id,data_inicio,dias_atestado,afastado_inss,numero_cat,data_retorno")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AtestadoAcidente[];
    },
  });
}

/** Lançamento de atestados por acidente de trabalho de um funcionário. */
export function AcidenteTrabalhoPanel({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const { data: todos = [] } = useAtestadosAcidente();
  const lista = todos.filter((a) => a.funcionario_id === funcionarioId);

  const [inicio, setInicio] = useState("");
  const [dias, setDias] = useState<number>(1);
  const [inss, setInss] = useState(false);
  const [cat, setCat] = useState("");
  const [retorno, setRetorno] = useState("");

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["atestados-acidente"] });
  };

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("atestados_acidente_trabalho" as any).insert({
        funcionario_id: funcionarioId,
        data_inicio: inicio,
        dias_atestado: Number(dias),
        afastado_inss: inss,
        numero_cat: cat.trim() || null,
        data_retorno: retorno || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atestado registrado");
      setInicio(""); setDias(1); setInss(false); setCat(""); setRetorno("");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar atestado"),
  });

  const atualizarRetorno = useMutation({
    mutationFn: async ({ id, data_retorno }: { id: string; data_retorno: string | null }) => {
      const { error } = await supabase
        .from("atestados_acidente_trabalho" as any)
        .update({ data_retorno } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar retorno"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("atestados_acidente_trabalho" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const situacao = situacaoAcidente(lista);

  return (
    <div className="col-span-2 rounded-md border p-3">
      <div className="text-sm font-medium">Acidente de trabalho (CAT e estabilidade)</div>

      {situacao && (
        <p className="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
          Situação atual: <strong>{situacao.situacao}</strong>
          {situacao.fimEstabilidade
            ? ` — estabilidade até ${fmtData(situacao.fimEstabilidade)}.`
            : " — a estabilidade de 12 meses começa a contar no retorno ao trabalho."}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="acid_inicio">Início do atestado</Label>
          <Input id="acid_inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="acid_dias">Dias de atestado</Label>
          <Input
            id="acid_dias"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="acid_cat">Número da CAT (opcional)</Label>
          <Input id="acid_cat" value={cat} onChange={(e) => setCat(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="acid_retorno">Data de retorno (se já voltou)</Label>
          <Input id="acid_retorno" type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inss} onChange={(e) => setInss(e.target.checked)} />
        Afastamento formalizado pelo INSS
      </label>

      <p className="mt-2 text-xs text-muted-foreground">
        A empresa paga no máximo <strong>15 dias</strong> de atestado (Lei 8.213/91, Art. 60, §3º),
        esteja o afastamento formalizado pelo INSS ou não.
        {dias > 0 && (
          <>
            {" "}Neste lançamento: <strong>{diasPagosEmpresa(dias)} dia(s)</strong> pagos pela empresa
            {dias > 15 ? ` e ${dias - 15} dia(s) fora da responsabilidade da empresa.` : "."}
          </>
        )}
      </p>

      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={!inicio || dias < 1 || criar.isPending}
        onClick={() => criar.mutate()}
      >
        Registrar atestado
      </Button>

      {lista.length > 0 && (
        <div className="mt-4 space-y-2">
          {lista.map((a) => (
            <div key={a.id} className="rounded border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {fmtData(a.data_inicio)} — {a.dias_atestado} dia(s) ·{" "}
                  {diasPagosEmpresa(a.dias_atestado)} pago(s) pela empresa
                  {a.afastado_inss ? " · INSS formalizado" : " · sem afastamento formal"}
                  {a.numero_cat ? ` · CAT ${a.numero_cat}` : ""}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remover.mutate(a.id!)}
                  aria-label="Excluir atestado"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-xs">Retorno:</Label>
                <Input
                  type="date"
                  className="h-8 w-40"
                  value={a.data_retorno?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    atualizarRetorno.mutate({ id: a.id!, data_retorno: e.target.value || null })
                  }
                />
                {a.data_retorno && (
                  <span className="text-muted-foreground">
                    Estabilidade até {fmtData(fimEstabilidadeAcidente(a.data_retorno))}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
