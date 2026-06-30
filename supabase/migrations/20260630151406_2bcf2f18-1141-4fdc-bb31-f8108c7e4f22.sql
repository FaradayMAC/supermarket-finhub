
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'funcionarios_prestador_id_fkey') THEN
    ALTER TABLE public.funcionarios
      ADD CONSTRAINT funcionarios_prestador_id_fkey
      FOREIGN KEY (prestador_id)
      REFERENCES public.prestadores_servico(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_funcionarios_prestador_id
  ON public.funcionarios(prestador_id);

CREATE OR REPLACE VIEW public.vw_prestador_funcionarios AS
SELECT
  p.id AS prestador_id,
  p.razao_social,
  p.nome_fantasia,
  p.regime_tributario,
  p.anexo_simples,
  p.aliquota_das,
  p.status,
  COUNT(f.id) AS total_funcionarios,
  COUNT(f.id) FILTER (WHERE f.ativo) AS funcionarios_ativos,
  COALESCE(SUM(f.salario_base) FILTER (WHERE f.ativo), 0) AS salario_bruto_ativos
FROM public.prestadores_servico p
LEFT JOIN public.funcionarios f ON f.prestador_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.vw_prestador_funcionarios TO authenticated, service_role;
