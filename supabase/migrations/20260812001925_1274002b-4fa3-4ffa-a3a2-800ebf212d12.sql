DROP INDEX IF EXISTS public.ferias_gozadas_func_competencia_uidx;
CREATE UNIQUE INDEX ferias_gozadas_func_competencia_uidx
  ON public.ferias_gozadas (funcionario_id, competencia);