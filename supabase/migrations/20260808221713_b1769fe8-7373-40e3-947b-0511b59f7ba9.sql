CREATE TABLE public.perdas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id),
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT 'outros',
  categoria text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perdas_estoque TO authenticated;
GRANT ALL ON public.perdas_estoque TO service_role;

ALTER TABLE public.perdas_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perdas view scoped" ON public.perdas_estoque
FOR SELECT TO authenticated
USING (public.can_view_all() OR public.is_manager_of(loja_id));

CREATE POLICY "perdas insert scoped" ON public.perdas_estoque
FOR INSERT TO authenticated
WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "perdas update scoped" ON public.perdas_estoque
FOR UPDATE TO authenticated
USING (public.can_edit_all() OR public.is_manager_of(loja_id))
WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "perdas delete scoped" ON public.perdas_estoque
FOR DELETE TO authenticated
USING (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE TRIGGER update_perdas_estoque_updated_at
BEFORE UPDATE ON public.perdas_estoque
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_perdas_estoque_loja_data ON public.perdas_estoque (loja_id, data);