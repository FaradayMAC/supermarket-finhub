ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_despesa(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_metas_categoria ON public.metas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_metas_loja_periodo ON public.metas(loja_id, periodo_inicio, periodo_fim);