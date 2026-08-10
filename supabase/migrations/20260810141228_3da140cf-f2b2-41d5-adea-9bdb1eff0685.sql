CREATE TABLE public.configuracoes (
  chave text PRIMARY KEY,
  valor numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logados podem ler configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin e controladoria editam configuracoes" ON public.configuracoes FOR ALL TO authenticated USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.configuracoes (chave, valor) VALUES ('salario_minimo', 1518);