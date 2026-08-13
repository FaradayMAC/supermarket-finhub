import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Store, ChevronDown } from "lucide-react";

export type AtalhoPeriodo = "mes" | "mes_passado" | "ano" | "tudo" | "custom";

export type LojaOpcao = { id: string; nome: string; codigo?: string | null };

const iso = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

export const ATALHOS: { value: AtalhoPeriodo; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Tudo" },
  { value: "custom", label: "Personalizado" },
];

function rangeDoAtalho(a: AtalhoPeriodo): { inicio: string; fim: string } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (a === "mes") return { inicio: iso(new Date(y, m, 1)), fim: iso(new Date(y, m + 1, 0)) };
  if (a === "mes_passado") return { inicio: iso(new Date(y, m - 1, 1)), fim: iso(new Date(y, m, 0)) };
  if (a === "ano") return { inicio: iso(new Date(y, 0, 1)), fim: iso(new Date(y, 11, 31)) };
  return { inicio: "", fim: "" };
}

export function useFiltroBar(atalhoInicial: AtalhoPeriodo = "mes") {
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [atalho, setAtalhoState] = useState<AtalhoPeriodo>(atalhoInicial);
  const inicial = rangeDoAtalho(atalhoInicial);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const setAtalho = useCallback((a: AtalhoPeriodo) => {
    setAtalhoState(a);
    if (a !== "custom") {
      const r = rangeDoAtalho(a);
      setInicio(r.inicio);
      setFim(r.fim);
    }
  }, []);

  const setInicioManual = useCallback((v: string) => {
    setAtalhoState("custom");
    setInicio(v);
  }, []);
  const setFimManual = useCallback((v: string) => {
    setAtalhoState("custom");
    setFim(v);
  }, []);

  const matchLoja = useCallback(
    (id?: string | null) => lojasSelecionadas.length === 0 || (!!id && lojasSelecionadas.includes(id)),
    [lojasSelecionadas],
  );

  const inPeriodo = useCallback(
    (v?: string | null) => {
      if (!inicio && !fim) return true;
      if (!v) return false;
      const d = v.slice(0, 10);
      if (inicio && d < inicio) return false;
      if (fim && d > fim) return false;
      return true;
    },
    [inicio, fim],
  );

  const matchBusca = useCallback(
    (...campos: (string | null | undefined)[]) => {
      if (!buscaDebounced) return true;
      return campos.some((c) => (c ?? "").toLowerCase().includes(buscaDebounced));
    },
    [buscaDebounced],
  );

  const meses = useMemo(() => {
    if (!inicio || !fim) return 12;
    const a = new Date(inicio), b = new Date(fim);
    return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
  }, [inicio, fim]);

  return {
    lojasSelecionadas, setLojasSelecionadas,
    atalho, setAtalho,
    inicio, fim, setInicio: setInicioManual, setFim: setFimManual,
    busca, setBusca, buscaDebounced,
    matchLoja, inPeriodo, matchBusca, meses,
  };
}

export type FiltroBarState = ReturnType<typeof useFiltroBar>;

function LojasSelect({ lojas, state }: { lojas: LojaOpcao[]; state: FiltroBarState }) {
  const sel = state.lojasSelecionadas;
  const label =
    sel.length === 0
      ? "Todas as lojas"
      : sel.length === 1
        ? (lojas.find((l) => l.id === sel[0])?.nome ?? "1 loja selecionada")
        : `${sel.length} lojas selecionadas`;

  const toggle = (id: string) =>
    state.setLojasSelecionadas(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-56 justify-between font-normal">
          <span className="flex min-w-0 items-center gap-2">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
          <Checkbox
            checked={sel.length === 0}
            onCheckedChange={() => state.setLojasSelecionadas([])}
          />
          <span className="font-medium">Todas</span>
        </label>
        <div className="my-1 border-t" />
        <div className="max-h-64 overflow-y-auto">
          {lojas.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox checked={sel.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
              <span className="truncate">{l.nome}{l.codigo ? ` (${l.codigo})` : ""}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FiltroBar({
  lojas,
  state,
  busca = true,
  periodo = true,
  buscaPlaceholder = "Buscar…",
  className = "",
}: {
  lojas: LojaOpcao[];
  state: FiltroBarState;
  busca?: boolean;
  periodo?: boolean;
  buscaPlaceholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <LojasSelect lojas={lojas} state={state} />

      {periodo && (
      <div className="flex flex-wrap items-center gap-1">
        {ATALHOS.filter((a) => a.value !== "custom").map((a) => (
          <Button
            key={a.value}
            type="button"
            size="sm"
            variant={state.atalho === a.value ? "default" : "outline"}
            onClick={() => state.setAtalho(a.value)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      )}

      {periodo && (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-[9.5rem]"
          value={state.inicio}
          max={state.fim || undefined}
          onChange={(e) => state.setInicio(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          className="w-[9.5rem]"
          value={state.fim}
          min={state.inicio || undefined}
          onChange={(e) => state.setFim(e.target.value)}
        />
      </div>
      )}

      {busca && (
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={buscaPlaceholder}
            value={state.busca}
            onChange={(e) => state.setBusca(e.target.value)}
          />
          <Label className="sr-only">Busca</Label>
        </div>
      )}
    </div>
  );
}
