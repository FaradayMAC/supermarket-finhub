CREATE TABLE public.extratos_bancarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id),
  loja_id uuid REFERENCES public.lojas(id),
  conta text NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('credito','debito')),
  conciliado boolean NOT NULL DEFAULT false,
  titulo_financeiro_id uuid REFERENCES public.titulos_financeiros(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extratos_data ON public.extratos_bancarios(data);
CREATE INDEX idx_extratos_loja ON public.extratos_bancarios(loja_id);
CREATE INDEX idx_extratos_titulo ON public.extratos_bancarios(titulo_financeiro_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extratos_bancarios TO authenticated;
GRANT ALL ON public.extratos_bancarios TO service_role;

ALTER TABLE public.extratos_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extratos_select" ON public.extratos_bancarios
  FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));

CREATE POLICY "extratos_insert" ON public.extratos_bancarios
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "extratos_update" ON public.extratos_bancarios
  FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "extratos_delete" ON public.extratos_bancarios
  FOR DELETE TO authenticated
  USING (public.can_edit_all());

CREATE TRIGGER trg_extratos_updated BEFORE UPDATE ON public.extratos_bancarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();