
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS fgts_saldo_inicial numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fgts_saldo_inicial_data date;

CREATE TABLE public.ferias_gozadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  data_inicio_gozo date NOT NULL,
  dias_gozados integer NOT NULL DEFAULT 30,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_gozadas TO authenticated;
GRANT ALL ON public.ferias_gozadas TO service_role;
ALTER TABLE public.ferias_gozadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_gozadas_select" ON public.ferias_gozadas
FOR SELECT TO authenticated
USING (
  public.can_view_all()
  OR EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = funcionario_id AND public.is_manager_of(f.loja_id))
);

CREATE POLICY "ferias_gozadas_write" ON public.ferias_gozadas
FOR ALL TO authenticated
USING (public.can_edit_all())
WITH CHECK (public.can_edit_all());

CREATE TRIGGER trg_ferias_gozadas_updated BEFORE UPDATE ON public.ferias_gozadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fgts_saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fgts_saques TO authenticated;
GRANT ALL ON public.fgts_saques TO service_role;
ALTER TABLE public.fgts_saques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fgts_saques_select" ON public.fgts_saques
FOR SELECT TO authenticated
USING (
  public.can_view_all()
  OR EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = funcionario_id AND public.is_manager_of(f.loja_id))
);

CREATE POLICY "fgts_saques_write" ON public.fgts_saques
FOR ALL TO authenticated
USING (public.can_edit_all())
WITH CHECK (public.can_edit_all());

CREATE TRIGGER trg_fgts_saques_updated BEFORE UPDATE ON public.fgts_saques
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ferias_gozadas_func ON public.ferias_gozadas(funcionario_id);
CREATE INDEX idx_fgts_saques_func ON public.fgts_saques(funcionario_id);
