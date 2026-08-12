CREATE UNIQUE INDEX IF NOT EXISTS ferias_gozadas_func_competencia_uidx
  ON public.ferias_gozadas (funcionario_id, competencia)
  WHERE competencia IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS afastamentos_inss_func_competencia_uidx
  ON public.afastamentos_inss (funcionario_id, competencia);