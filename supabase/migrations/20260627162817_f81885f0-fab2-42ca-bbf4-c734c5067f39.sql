ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS vale_transporte numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_alimentacao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano_saude numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dependentes integer NOT NULL DEFAULT 0;