ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS regime_tributario text NOT NULL DEFAULT 'simples';

UPDATE public.empresas e
SET regime_tributario = sub.regime
FROM (
  SELECT l.empresa_id AS empresa_id,
         CASE WHEN COUNT(*) FILTER (WHERE f.regime_tributario = 'lucro_real') * 2 > COUNT(*) THEN 'lucro_real' ELSE 'simples' END AS regime
  FROM public.funcionarios f
  JOIN public.lojas l ON l.id = f.loja_id
  WHERE l.empresa_id IS NOT NULL
  GROUP BY l.empresa_id
) sub
WHERE e.id = sub.empresa_id;

ALTER TABLE public.funcionarios DROP COLUMN IF EXISTS regime_tributario;