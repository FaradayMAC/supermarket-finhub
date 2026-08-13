import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Log de auditoria · MercadoGest" },
      {
        name: "description",
        content:
          "Histórico de alterações nas tabelas sensíveis: quem alterou, o que mudou e quando.",
      },
      { property: "og:title", content: "Log de auditoria · MercadoGest" },
      {
        property: "og:description",
        content: "Rastreabilidade das alterações em funcionários, folha, cofre e configurações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auditoria,
});

const TABELAS = [
  { value: "funcionarios", label: "Funcionários" },
  { value: "cargos", label: "Cargos" },
  { value: "configuracoes", label: "Configurações" },
  { value: "cofre_movimentacoes", label: "Cofre" },
  { value: "folha_pagamento", label: "Folha de pagamento" },
  { value: "titulos_financeiros", label: "Títulos financeiros" },
];

const ACAO_LABEL: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
};

const IGNORAR_CAMPOS = new Set(["updated_at", "created_at"]);

type Registro = {
  id: string;
  tabela: string;
  registro_id: string | null;
  acao: string;
  usuario_id: string | null;
  dados_antigos: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
};

const fmtValor = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function camposAlterados(r: Registro) {
  const antigo = r.dados_antigos ?? {};
  const novo = r.dados_novos ?? {};
  const chaves = new Set([...Object.keys(antigo), ...Object.keys(novo)]);
  const out: { campo: string; de: unknown; para: unknown }[] = [];
  for (const c of chaves) {
    if (IGNORAR_CAMPOS.has(c)) continue;
    const de = (antigo as Record<string, unknown>)[c];
    const para = (novo as Record<string, unknown>)[c];
    if (JSON.stringify(de ?? null) === JSON.stringify(para ?? null)) continue;
    out.push({ campo: c, de, para });
  }
  return out.sort((a, b) => a.campo.localeCompare(b.campo));
}

function Auditoria() {
  const auth = useAuth();
  const [tabela, setTabela] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria", tabela, usuario, de, ate],
    enabled: auth.isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("id, tabela, registro_id, acao, usuario_id, dados_antigos, dados_novos, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      if (usuario !== "todos") q = q.eq("usuario_id", usuario);
      if (de) q = q.gte("created_at", `${de}T00:00:00`);
      if (ate) q = q.lte("created_at", `${ate}T23:59:59`);
      const [{ data: logs, error }, { data: perfis }] = await Promise.all([
        q,
        supabase.from("profiles").select("id, nome, email"),
      ]);
      if (error) throw error;
      return { logs: (logs ?? []) as Registro[], perfis: perfis ?? [] };
    },
  });

  const nomeUsuario = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data?.perfis ?? []) m.set(p.id, p.nome || p.email || p.id.slice(0, 8));
    return m;
  }, [data?.perfis]);

  if (!auth.isAdmin) {
    return (
      <AppShell title="Log de auditoria">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Acesso restrito ao Administrador.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const logs = data?.logs ?? [];

  return (
    <AppShell title="Log de auditoria">
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Tabela</Label>
              <Select value={tabela} onValueChange={setTabela}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {TABELAS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <Select value={usuario} onValueChange={setUsuario}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(data?.perfis ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando…</div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
                <ScrollText className="h-8 w-8" />
                Nenhuma alteração registrada para os filtros aplicados.
              </div>
            ) : (
              <div className="divide-y">
                {logs.map((r) => {
                  const mudancas = camposAlterados(r);
                  const expandido = aberto === r.id;
                  const label =
                    TABELAS.find((t) => t.value === r.tabela)?.label ?? r.tabela;
                  return (
                    <div key={r.id}>
                      <Button
                        variant="ghost"
                        onClick={() => setAberto(expandido ? null : r.id)}
                        className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-3 text-left"
                      >
                        {expandido ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <Badge
                          variant={
                            r.acao === "delete"
                              ? "destructive"
                              : r.acao === "insert"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {ACAO_LABEL[r.acao] ?? r.acao}
                        </Badge>
                        <span className="font-medium">{label}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {nomeUsuario.get(r.usuario_id ?? "") ?? "Sistema"}
                        </span>
                        <span className="ml-auto shrink-0 text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </span>
                      </Button>
                      {expandido && (
                        <div className="bg-muted/40 px-4 pb-4 pt-1">
                          {mudancas.length === 0 ? (
                            <p className="py-2 text-sm text-muted-foreground">
                              Nenhum campo relevante alterado.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-muted-foreground">
                                  <tr className="text-left">
                                    <th className="py-2 pr-4 font-medium">Campo</th>
                                    <th className="py-2 pr-4 font-medium">De</th>
                                    <th className="py-2 font-medium">Para</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mudancas.map((m) => (
                                    <tr key={m.campo} className="border-t border-border/60">
                                      <td className="py-2 pr-4 font-mono text-xs">{m.campo}</td>
                                      <td className="py-2 pr-4 text-muted-foreground line-through">
                                        {fmtValor(m.de)}
                                      </td>
                                      <td className="py-2 font-medium">{fmtValor(m.para)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {r.registro_id && (
                            <p className="pt-3 font-mono text-xs text-muted-foreground">
                              Registro: {r.registro_id}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
