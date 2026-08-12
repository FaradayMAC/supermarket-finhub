ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS motivo_desligamento text
  CHECK (motivo_desligamento IN ('sem_justa_causa','pedido_demissao','acordo_mutuo','justa_causa'));