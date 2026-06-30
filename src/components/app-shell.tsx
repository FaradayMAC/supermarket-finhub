import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Store, Receipt, Users, Calculator, Landmark, Target, Scale, Shield, LogOut, FileBarChart, Wallet, Briefcase } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth, ROLE_LABEL, signOut } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NavItem = { to: string; label: string; icon: any; admin?: boolean };

const ALL_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lojas", label: "Lojas", icon: Store },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/prestadores", label: "Prestadoras", icon: Briefcase },
  { to: "/impostos", label: "Impostos", icon: Landmark },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/caixa", label: "Caixa", icon: Wallet },
  { to: "/dre", label: "DRE", icon: FileBarChart },
  { to: "/comparativo", label: "Compar.", icon: Scale },
  { to: "/calculadora", label: "Calc.", icon: Calculator },
  { to: "/usuarios", label: "Usuários", icon: Shield, admin: true },
];

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const auth = useAuth();
  const nav = ALL_NAV.filter((i) => !i.admin || auth.isAdmin);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="px-6 py-5 border-b">
          <div className="text-sm font-semibold text-muted-foreground">REDE FINANCEIRA</div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-foreground">Mercado<span className="text-primary">Gest</span></div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
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
          {nav.map((item) => {
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
