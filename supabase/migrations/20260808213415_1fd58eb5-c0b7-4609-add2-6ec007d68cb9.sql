-- FORNECEDORES
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "fornecedores_write" ON public.fornecedores FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.can_edit_all() OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUTOS
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  nome text NOT NULL,
  categoria_produto text,
  unidade text NOT NULL DEFAULT 'UN',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "produtos_write" ON public.produtos FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.can_edit_all() OR public.has_role(auth.uid(),'gerente'));
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COMPRAS DE MERCADORIA
CREATE TABLE public.compras_mercadoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id),
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  data_compra date NOT NULL,
  numero_nf text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','pago')),
  data_pagamento date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_mercadoria TO authenticated;
GRANT ALL ON public.compras_mercadoria TO service_role;
ALTER TABLE public.compras_mercadoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras_select" ON public.compras_mercadoria FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "compras_insert" ON public.compras_mercadoria FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "compras_update" ON public.compras_mercadoria FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "compras_delete" ON public.compras_mercadoria FOR DELETE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE TRIGGER trg_compras_updated BEFORE UPDATE ON public.compras_mercadoria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_compras_loja_data ON public.compras_mercadoria (loja_id, data_compra);

-- ITENS
CREATE TABLE public.compras_mercadoria_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras_mercadoria(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao text,
  quantidade numeric(14,3) NOT NULL DEFAULT 1,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS (ROUND(quantidade * valor_unitario, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_mercadoria_itens TO authenticated;
GRANT ALL ON public.compras_mercadoria_itens TO service_role;
ALTER TABLE public.compras_mercadoria_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras_itens_select" ON public.compras_mercadoria_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND (public.can_view_all() OR public.is_manager_of(c.loja_id))));
CREATE POLICY "compras_itens_write" ON public.compras_mercadoria_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND (public.can_edit_all() OR public.is_manager_of(c.loja_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND (public.can_edit_all() OR public.is_manager_of(c.loja_id))));
CREATE INDEX idx_compras_itens_compra ON public.compras_mercadoria_itens (compra_id);

-- Espelho em movimentações financeiras
CREATE OR REPLACE FUNCTION public.mirror_compra_to_mov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='compra' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.movimentacoes_financeiras
    (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
  VALUES
    (NEW.empresa_id, NEW.loja_id, 'saida', 'compra', NEW.id,
     'Compra de mercadoria' || COALESCE(' — NF ' || NEW.numero_nf, ''),
     NEW.valor_total, COALESCE(NEW.data_pagamento, NEW.data_compra),
     CASE WHEN NEW.status = 'pago' THEN 'confirmado' ELSE 'previsto' END)
  ON CONFLICT (origem, origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL
  DO UPDATE SET empresa_id=EXCLUDED.empresa_id, loja_id=EXCLUDED.loja_id,
    descricao=EXCLUDED.descricao, valor=EXCLUDED.valor,
    data_movimentacao=EXCLUDED.data_movimentacao, status=EXCLUDED.status, updated_at=now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mirror_compra
AFTER INSERT OR UPDATE OR DELETE ON public.compras_mercadoria
FOR EACH ROW EXECUTE FUNCTION public.mirror_compra_to_mov();

-- Recalcula o total da compra a partir dos itens (quando houver itens)
CREATE OR REPLACE FUNCTION public.recalc_compra_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_compra uuid; v_total numeric(14,2); v_count int;
BEGIN
  v_compra := COALESCE(NEW.compra_id, OLD.compra_id);
  SELECT COALESCE(SUM(valor_total),0), COUNT(*) INTO v_total, v_count
    FROM public.compras_mercadoria_itens WHERE compra_id = v_compra;
  IF v_count > 0 THEN
    UPDATE public.compras_mercadoria SET valor_total = v_total WHERE id = v_compra;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_compra_itens_total
AFTER INSERT OR UPDATE OR DELETE ON public.compras_mercadoria_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_compra_total();