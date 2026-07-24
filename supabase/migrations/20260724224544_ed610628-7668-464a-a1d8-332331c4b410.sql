
CREATE TABLE public.faltas_rh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade >= 0 AND quantidade <= 31),
  mes_referencia date NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faltas_rh TO authenticated;
GRANT ALL ON public.faltas_rh TO service_role;

ALTER TABLE public.faltas_rh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faltas select" ON public.faltas_rh FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));

CREATE POLICY "faltas modify" ON public.faltas_rh FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE TRIGGER update_faltas_rh_updated_at
  BEFORE UPDATE ON public.faltas_rh
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_faltas_rh_loja ON public.faltas_rh(loja_id);
CREATE INDEX idx_faltas_rh_funcionario ON public.faltas_rh(funcionario_id);
CREATE INDEX idx_faltas_rh_mes ON public.faltas_rh(mes_referencia);
