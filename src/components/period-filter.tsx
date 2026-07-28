import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type PeriodoValue = "1m" | "3m" | "6m" | "12m" | "all" | "custom";

const iso = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

export function usePeriodo(initial: PeriodoValue = "1m") {
  const [periodo, setPeriodo] = useState<PeriodoValue>(initial);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [customFrom, setCustomFrom] = useState(iso(inicioMes));
  const [customTo, setCustomTo] = useState(iso(hoje));

  const monthsBack =
    periodo === "1m" ? 1 : periodo === "3m" ? 3 : periodo === "6m" ? 6 : periodo === "12m" ? 12 : null;

  const { from, to } = useMemo(() => {
    if (periodo === "custom") return { from: customFrom || null, to: customTo || null };
    if (!monthsBack) return { from: null as string | null, to: null as string | null };
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (monthsBack - 1));
    return { from: iso(d), to: null as string | null };
  }, [periodo, monthsBack, customFrom, customTo]);

  const inWindow = (v?: string | null) => {
    if (!v) return false;
    const d = v.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const meses = useMemo(() => {
    if (periodo === "custom" && from && to) {
      const a = new Date(from), b = new Date(to);
      return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
    }
    return monthsBack ?? 12;
  }, [periodo, monthsBack, from, to]);

  return {
    periodo, setPeriodo,
    customFrom, setCustomFrom,
    customTo, setCustomTo,
    from, to, inWindow, meses, monthsBack,
  };
}

export type PeriodoState = ReturnType<typeof usePeriodo>;

export function PeriodFilter({ state, showLabel = true }: { state: PeriodoState; showLabel?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLabel && (
        <Label className="hidden text-xs uppercase text-muted-foreground sm:inline">Período:</Label>
      )}
      <Select value={state.periodo} onValueChange={(v) => state.setPeriodo(v as PeriodoValue)}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1m">Mês atual</SelectItem>
          <SelectItem value="3m">Últimos 3 meses</SelectItem>
          <SelectItem value="6m">Últimos 6 meses</SelectItem>
          <SelectItem value="12m">Últimos 12 meses</SelectItem>
          <SelectItem value="all">Tudo</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {state.periodo === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[9.5rem]"
            value={state.customFrom}
            max={state.customTo || undefined}
            onChange={(e) => state.setCustomFrom(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="w-[9.5rem]"
            value={state.customTo}
            min={state.customFrom || undefined}
            onChange={(e) => state.setCustomTo(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
