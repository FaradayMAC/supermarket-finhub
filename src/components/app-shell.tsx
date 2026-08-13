import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Store, Receipt, Users, IdCard, CalendarX, Landmark, Target, Scale, Shield, LogOut, FileBarChart, Wallet, Briefcase, FileText, ShoppingCart, PackageSearch, CalendarClock, Banknote, Gauge, FileMinus, ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState, useMemo } from "react";
import { useAuth, ROLE_LABEL, signOut } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type NavItem = { to: string; label: string; icon: any; admin?: boolean };
type NavGroup = { label: string; items: NavItem[]; defaultOpen?: boolean };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão Geral",
    defaultOpen: true,
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingCart },
      { to: "/compras", label: "Compras", icon: PackageSearch },
      { to: "/despesas", label: "Despesas", icon: Receipt },
      { to: "/caixa", label: "Caixa", icon: Wallet },
      { to: "/titulos", label: "A pagar/receber", icon: CalendarClock },
      { to: "/conciliacao", label: "Conciliação", icon: Banknote },
      { to: "/impostos", label: "Impostos", icon: Landmark },
      { to: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { to: "/indicadores", label: "Indicadores", icon: Gauge },
      { to: "/dre", label: "DRE", icon: FileBarChart },
      { to: "/comparativo", label: "Comparativo", icon: Scale },
    ],
  },
  {
    label: "Pessoas (RH)",
    items: [
      { to: "/funcionarios", label: "Funcionários", icon: Users },
      { to: "/cargos", label: "Cargos", icon: IdCard },
      { to: "/faltas-rh", label: "Faltas RH", icon: CalendarX },
      { to: "/contracheque", label: "Contra cheque", icon: FileText },
      { to: "/rescisao", label: "Rescisão", icon: FileMinus },
      { to: "/prestadores", label: "Prestadoras", icon: Briefcase },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/lojas", label: "Lojas", icon: Store },
      { to: "/usuarios", label: "Usuários", icon: Shield, admin: true },
      { to: "/auditoria", label: "Log de auditoria", icon: ScrollText, admin: true },

    ],
  },
];

const STORAGE_KEY = "mercadogest-nav-groups";

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const auth = useAuth();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const groups = useMemo(() => {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.admin || auth.isAdmin),
    })).filter((g) => g.items.length > 0);
  }, [auth.isAdmin]);

  const activeGroupLabel = useMemo(() => {
    return groups.find((g) => g.items.some((i) => i.to === currentPath))?.label ?? null;
  }, [groups, currentPath]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      initial[g.label] = g.defaultOpen || g.label === activeGroupLabel;
    });
    return initial;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setOpenMap((prev) => {
          const merged: Record<string, boolean> = {};
          groups.forEach((g) => {
            merged[g.label] = parsed[g.label] ?? g.defaultOpen ?? g.label === activeGroupLabel;
          });
          return merged;
        });
      }
    } catch {
      // ignore parse errors
    }
  }, [activeGroupLabel]);

  const toggleGroup = (label: string) => {
    setOpenMap((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="px-6 py-5 border-b">
          <div className="text-sm font-semibold text-muted-foreground">REDE FINANCEIRA</div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-foreground">Mercado<span className="text-primary">Gest</span></div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {groups.map((group) => {
            const isOpen = openMap[group.label] ?? group.defaultOpen ?? group.label === activeGroupLabel;
            const hasActive = group.items.some((i) => i.to === currentPath);
            return (
              <Collapsible
                key={group.label}
                open={isOpen}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <span>{group.label}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-1 pt-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.to === currentPath;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        activeOptions={{ exact: item.to === "/" }}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-2">
          {auth.user && (
            <div className="text-xs">
              <div className="font-medium text-foreground truncate">{auth.profile?.nome ?? auth.user.email}</div>
              <div className="text-muted-foreground truncate">{auth.user.email}</div>
              {auth.role && <Badge variant="outline" className="mt-1">{ROLE_LABEL[auth.role]}</Badge>}
              {!auth.role && <Badge variant="destructive" className="mt-1">Sem perfil</Badge>}
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <main className="px-4 py-6 sm:px-8 sm:py-8">
          {!auth.loading && !auth.role && (
            <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
              Sua conta ainda não tem perfil atribuído. Solicite ao Administrador.
            </div>
          )}
          {children}
        </main>

        {/* Mobile nav */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t bg-background lg:hidden">
          {groups.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex min-w-[72px] flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="h-16 lg:hidden" />
      </div>
    </div>
  );
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
