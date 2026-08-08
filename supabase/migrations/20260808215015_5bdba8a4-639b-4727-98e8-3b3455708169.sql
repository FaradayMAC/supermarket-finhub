ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'mercadoria',
  ADD COLUMN IF NOT EXISTS condicao_pagamento_padrao text;

ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_categoria_chk
  CHECK (categoria IN ('mercadoria','servico','manutencao','outros'));

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON public.despesas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa ON public.fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_categoria ON public.fornecedores(categoria);