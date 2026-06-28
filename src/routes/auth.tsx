import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · MercadoGest" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/" });
    });
  }, [nav]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav({ to: "/" });
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password: pwd,
      options: { emailRedirectTo: window.location.origin, data: { full_name: nome } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro criado. Aguarde um administrador atribuir seu perfil.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Falha ao entrar com Google");
    else if (!r.redirected) nav({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-sm font-semibold text-muted-foreground">REDE FINANCEIRA</div>
          <div className="text-2xl font-bold tracking-tight">Mercado<span className="text-primary">Gest</span></div>
        </div>
        <Card>
          <CardHeader><CardTitle>Acesse sua conta</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={login} className="space-y-3 pt-4">
                  <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                  <div><Label>Senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required /></div>
                  <Button type="submit" className="w-full" disabled={busy}>Entrar</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signup} className="space-y-3 pt-4">
                  <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                  <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                  <div><Label>Senha</Label><Input type="password" minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} required /></div>
                  <Button type="submit" className="w-full" disabled={busy}>Criar conta</Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              Entrar com Google
            </Button>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Novos cadastros recebem perfil após aprovação do administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
