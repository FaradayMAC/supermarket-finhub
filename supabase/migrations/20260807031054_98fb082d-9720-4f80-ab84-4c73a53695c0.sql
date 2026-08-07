CREATE TABLE public.convenio_funcionario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenio_funcionario TO authenticated;
GRANT ALL ON public.convenio_funcionario TO service_role;

ALTER TABLE public.convenio_funcionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "convenio_select" ON public.convenio_funcionario
  FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));

CREATE POLICY "convenio_write" ON public.convenio_funcionario
  FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE TRIGGER trg_convenio_updated BEFORE UPDATE ON public.convenio_funcionario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();