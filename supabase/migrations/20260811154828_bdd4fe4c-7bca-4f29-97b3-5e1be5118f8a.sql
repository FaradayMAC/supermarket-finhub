ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS calcula_encargos boolean NOT NULL DEFAULT true;