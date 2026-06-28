import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthGate,
});

function AuthGate() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!auth.approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle className="text-center">Conta aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Olá{auth.profile?.nome ? `, ${auth.profile.nome}` : ""}. Sua conta
              <b> {auth.user?.email}</b> foi criada com sucesso, mas ainda precisa
              ser autorizada por um administrador antes que você possa acessar
              o sistema.
            </p>
            <p className="text-xs text-muted-foreground">
              Avise o administrador da rede para liberar seu perfil. Após a
              aprovação, basta entrar novamente.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
