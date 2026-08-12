CREATE TABLE public.cofre_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  origem text NOT NULL CHECK (origem IN ('venda_dinheiro','folha','despesa','deposito_bancario','avulso')),
  origem_id uuid,
  descricao text,
  motivo text NOT NULL,
  valor numeric(14,2) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cofre_movimentacoes TO authenticated;
GRANT ALL ON public.cofre_movimentacoes TO service_role;

ALTER TABLE public.cofre_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cofre_select" ON public.cofre_movimentacoes FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "cofre_insert" ON public.cofre_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "cofre_update" ON public.cofre_movimentacoes FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "cofre_delete" ON public.cofre_movimentacoes FOR DELETE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE UNIQUE INDEX cofre_origem_unico ON public.cofre_movimentacoes (origem, origem_id)
  WHERE origem_id IS NOT NULL;
CREATE INDEX cofre_loja_data ON public.cofre_movimentacoes (loja_id, data);

CREATE TRIGGER trg_cofre_updated BEFORE UPDATE ON public.cofre_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.mirror_venda_dinheiro_to_cofre()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.cofre_movimentacoes WHERE origem='venda_dinheiro' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  IF COALESCE(NEW.valor_dinheiro,0) > 0 THEN
    INSERT INTO public.cofre_movimentacoes (loja_id, data, tipo, origem, origem_id, descricao, motivo, valor)
    VALUES (NEW.loja_id, NEW.data, 'entrada', 'venda_dinheiro', NEW.id,
            'Venda em dinheiro', 'Recebimento de venda', NEW.valor_dinheiro)
    ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
    DO UPDATE SET valor = EXCLUDED.valor, data = EXCLUDED.data, loja_id = EXCLUDED.loja_id;
  ELSE
    DELETE FROM public.cofre_movimentacoes WHERE origem='venda_dinheiro' AND origem_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mirror_venda_cofre AFTER INSERT OR UPDATE OR DELETE ON public.vendas_diarias
FOR EACH ROW EXECUTE FUNCTION public.mirror_venda_dinheiro_to_cofre();

INSERT INTO public.cofre_movimentacoes (loja_id, data, tipo, origem, origem_id, descricao, motivo, valor)
SELECT loja_id, data, 'entrada', 'venda_dinheiro', id, 'Venda em dinheiro', 'Recebimento de venda', valor_dinheiro
FROM public.vendas_diarias WHERE COALESCE(valor_dinheiro,0) > 0
ON CONFLICT DO NOTHING;