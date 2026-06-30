
CREATE TABLE public.prestadores_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  anexo_simples text,
  aliquota_das numeric NOT NULL DEFAULT 0,
  responsavel text,
  telefone text,
  email text,
  status text NOT NULL DEFAULT 'ativa',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestadores_servico TO authenticated;
GRANT ALL ON public.prestadores_servico TO service_role;

ALTER TABLE public.prestadores_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read prestadores" ON public.prestadores_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write prestadores" ON public.prestadores_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_prestadores_servico_updated_at
  BEFORE UPDATE ON public.prestadores_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
