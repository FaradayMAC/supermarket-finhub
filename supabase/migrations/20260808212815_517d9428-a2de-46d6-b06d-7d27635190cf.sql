CREATE TABLE public.vendas_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id),
  data date NOT NULL,
  valor_dinheiro numeric(14,2) NOT NULL DEFAULT 0,
  valor_pix numeric(14,2) NOT NULL DEFAULT 0,
  valor_cartao_debito numeric(14,2) NOT NULL DEFAULT 0,
  valor_cartao_credito numeric(14,2) NOT NULL DEFAULT 0,
  valor_outros numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS (
    valor_dinheiro + valor_pix + valor_cartao_debito + valor_cartao_credito + valor_outros
  ) STORED,
  qtd_cupons integer NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'manual' CHECK (fonte IN ('manual','importado_planilha','integracao_pdv')),
  conferido_caixa boolean NOT NULL DEFAULT false,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_diarias TO authenticated;
GRANT ALL ON public.vendas_diarias TO service_role;

ALTER TABLE public.vendas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_select" ON public.vendas_diarias
  FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));

CREATE POLICY "vendas_insert" ON public.vendas_diarias
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "vendas_update" ON public.vendas_diarias
  FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE POLICY "vendas_delete" ON public.vendas_diarias
  FOR DELETE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE TRIGGER trg_vendas_updated BEFORE UPDATE ON public.vendas_diarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vendas_loja_data ON public.vendas_diarias (loja_id, data);

CREATE OR REPLACE FUNCTION public.mirror_venda_to_mov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='venda' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.movimentacoes_financeiras
    (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
  VALUES
    (NEW.empresa_id, NEW.loja_id, 'entrada', 'venda', NEW.id,
     'Venda diária', NEW.valor_total, NEW.data, 'confirmado')
  ON CONFLICT (origem, origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL
  DO UPDATE SET empresa_id=EXCLUDED.empresa_id, loja_id=EXCLUDED.loja_id,
    valor=EXCLUDED.valor, data_movimentacao=EXCLUDED.data_movimentacao,
    status=EXCLUDED.status, updated_at=now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mirror_venda
AFTER INSERT OR UPDATE OR DELETE ON public.vendas_diarias
FOR EACH ROW EXECUTE FUNCTION public.mirror_venda_to_mov();