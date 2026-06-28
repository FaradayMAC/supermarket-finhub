ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS regime_tributario text NOT NULL DEFAULT 'simples' CHECK (regime_tributario IN ('simples','lucro_real')),
  ADD COLUMN IF NOT EXISTS salario_familia numeric NOT NULL DEFAULT 0;