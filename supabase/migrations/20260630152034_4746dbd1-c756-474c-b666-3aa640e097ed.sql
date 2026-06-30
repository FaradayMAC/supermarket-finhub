
CREATE TABLE public.prestador_das_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id UUID NOT NULL REFERENCES public.prestadores_servico(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prestador_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_das_mensal TO authenticated;
GRANT ALL ON public.prestador_das_mensal TO service_role;

ALTER TABLE public.prestador_das_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read das" ON public.prestador_das_mensal FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write das" ON public.prestador_das_mensal FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_das_prestador ON public.prestador_das_mensal(prestador_id);
CREATE INDEX idx_das_competencia ON public.prestador_das_mensal(competencia);

CREATE TRIGGER update_prestador_das_updated_at
  BEFORE UPDATE ON public.prestador_das_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
