import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { verificarLimiteCid, type AtestadoMedico } from "@/lib/notificacoes";

const fmtData = (v?: string | null) =>
  v
    ? new Date(String(v).slice(0, 10) + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "—";

export function useAtestadosMedicos() {
  return useQuery({
    queryKey: ["atestados-medicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atestados_medicos" as any)
        .select("id,funcionario_id,data_inicio,dias,cid")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AtestadoMedico[];
    },
    staleTime: 60 * 1000,
  });
}

/** Lançamento de atestados médicos com CID (soma por CID em 60 dias). */
export function AtestadosMedicosPanel({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const { data: todos = [] } = useAtestadosMedicos();
  const lista = todos.filter((a) => a.funcionario_id === funcionarioId);

  const [inicio, setInicio] = useState("");
  const [dias, setDias] = useState<number>(1);
  const [cid, setCid] = useState("");

  const invalidar = () => qc.invalidateQueries({ queryKey: ["atestados-medicos"] });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("atestados_medicos" as any).insert({
        funcionario_id: funcionarioId,
        data_inicio: inicio,
        dias: Number(dias),
        cid: cid.trim().toUpperCase(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atestado registrado");
      setInicio(""); setDias(1); setCid("");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar atestado"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atestados_medicos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const alertas = verificarLimiteCid(lista);

  return (
    <div className="col-span-2 rounded-md border p-3">
      <div className="text-sm font-medium">Atestados médicos (CID)</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Registre todos os atestados, mesmo os curtos. Atestados do mesmo CID somados dentro de
        60 dias que ultrapassem 15 dias exigem encaminhamento à perícia do INSS
        (Decreto 3.048/99, Art. 75, §§ 4º e 5º).
      </p>

      {alertas.length > 0 && (
        <p className="mt-2 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          {alertas[alertas.length - 1].mensagem}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="atm_inicio">Início</Label>
          <Input id="atm_inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="atm_dias">Dias</Label>
          <Input
            id="atm_dias"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="atm_cid">CID</Label>
          <Input
            id="atm_cid"
            placeholder="M54.5"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={!inicio || dias < 1 || !cid.trim() || criar.isPending}
        onClick={() => criar.mutate()}
      >
        Registrar atestado
      </Button>

      {lista.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs">
              <span>
                {fmtData(a.data_inicio)} — {a.dias} dia(s) · CID {a.cid}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
