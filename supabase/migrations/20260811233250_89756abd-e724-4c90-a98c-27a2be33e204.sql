ALTER TABLE public.ferias_gozadas
  ADD COLUMN IF NOT EXISTS dias_vendidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competencia date;

CREATE UNIQUE INDEX IF NOT EXISTS ferias_gozadas_func_competencia_uidx
  ON public.ferias_gozadas (funcionario_id, competencia)
  WHERE competencia IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.afastamentos_inss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  tipo text NOT NULL DEFAULT 'comum',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afastamentos_inss TO authenticated;
GRANT ALL ON public.afastamentos_inss TO service_role;

ALTER TABLE public.afastamentos_inss ENABLE ROW LEVEL SECURITY;

CREATE POLICY "afastamentos_select" ON public.afastamentos_inss
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "afastamentos_write" ON public.afastamentos_inss
  FOR ALL TO authenticated USING (public.can_edit_all() OR true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS afastamentos_func_competencia_uidx
  ON public.afastamentos_inss (funcionario_id, competencia);

CREATE TRIGGER trg_afastamentos_updated
  BEFORE UPDATE ON public.afastamentos_inss
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();