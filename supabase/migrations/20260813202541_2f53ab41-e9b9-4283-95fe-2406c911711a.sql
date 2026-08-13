ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_confirmacao_gravidez date,
  ADD COLUMN IF NOT EXISTS data_parto date,
  ADD COLUMN IF NOT EXISTS data_retorno_licenca_maternidade date;