import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, HeartPulse, CalendarClock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  notificacoesDoDia,
  filtrarNaoLidas,
  LABEL_TIPO,
  type Notificacao,
} from "@/lib/notificacoes";

export function NotificacoesSino() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["notificacoes-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, data_admissao, data_fim_experiencia, data_desligamento")
        .is("data_desligamento", null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: lidas = [] } = useQuery({
    queryKey: ["notificacoes-lidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_lidas")
        .select("funcionario_id, tipo, data_evento");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });

  const pendentes = useMemo(
    () => filtrarNaoLidas(notificacoesDoDia(funcionarios as any, new Date()), lidas as any),
    [funcionarios, lidas],
  );

  const marcarLida = useMutation({
    mutationFn: async (n: Notificacao) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("notificacoes_lidas").insert({
        funcionario_id: n.funcionario_id,
        tipo: n.tipo,
        data_evento: n.data_evento,
        lida_por: userRes.user?.id ?? null,
      });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes-lidas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar notificação"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {pendentes.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {pendentes.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          <Badge variant="outline">{pendentes.length} pendente(s)</Badge>
        </div>
        {pendentes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação para hoje.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {pendentes.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {n.tipo === "plano_saude" ? (
                      <HeartPulse className="h-4 w-4" />
                    ) : (
                      <CalendarClock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {LABEL_TIPO[n.tipo]}
                    </p>
                    <p className="text-sm">{n.mensagem}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        to="/funcionarios"
                        search={{ f: n.funcionario_id } as any}
                        onClick={() => setOpen(false)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Abrir cadastro
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => marcarLida.mutate(n)}
                      >
                        <Check className="mr-1 h-3 w-3" /> Resolvida
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
