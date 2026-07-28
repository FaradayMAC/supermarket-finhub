ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS insalubridade_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periculosidade_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quebra_caixa_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_vt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS observacoes text;