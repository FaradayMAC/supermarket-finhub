-- ============ TÍTULOS FINANCEIROS (contas a pagar / receber) ============
CREATE TABLE public.titulos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('pagar','receber')),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  numero_documento text,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric(14,2) NOT NULL CHECK (valor_total >= 0),
  num_parcelas integer NOT NULL DEFAULT 1 CHECK (num_parcelas >= 1),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','parcial','quitado','cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titulos_financeiros TO authenticated;
GRANT ALL ON public.titulos_financeiros TO service_role;
ALTER TABLE public.titulos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "titulos_select" ON public.titulos_financeiros FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "titulos_write" ON public.titulos_financeiros FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

CREATE TABLE public.titulo_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.titulos_financeiros(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  data_vencimento date NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  data_pagamento date,
  forma_pagamento text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','parcial','paga','cancelada')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (titulo_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.titulo_parcelas TO authenticated;
GRANT ALL ON public.titulo_parcelas TO service_role;
ALTER TABLE public.titulo_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcelas_select" ON public.titulo_parcelas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.titulos_financeiros t WHERE t.id = titulo_id
    AND (public.can_view_all() OR public.is_manager_of(t.loja_id))));
CREATE POLICY "parcelas_write" ON public.titulo_parcelas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.titulos_financeiros t WHERE t.id = titulo_id
    AND (public.can_edit_all() OR public.is_manager_of(t.loja_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.titulos_financeiros t WHERE t.id = titulo_id
    AND (public.can_edit_all() OR public.is_manager_of(t.loja_id))));

CREATE INDEX idx_titulos_loja_venc ON public.titulos_financeiros(loja_id, data_emissao);
CREATE INDEX idx_parcelas_venc ON public.titulo_parcelas(data_vencimento, status);
CREATE INDEX idx_parcelas_titulo ON public.titulo_parcelas(titulo_id);

CREATE TRIGGER trg_titulos_updated BEFORE UPDATE ON public.titulos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_parcelas_updated BEFORE UPDATE ON public.titulo_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- vínculo opcional despesa -> parcela
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES public.titulo_parcelas(id) ON DELETE SET NULL;

-- ============ espelho no fluxo de caixa ============
CREATE OR REPLACE FUNCTION public.mirror_parcela_to_mov()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.titulos_financeiros%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='parcela' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT * INTO t FROM public.titulos_financeiros WHERE id = NEW.titulo_id;
  DELETE FROM public.movimentacoes_financeiras WHERE origem='parcela' AND origem_id = NEW.id;

  IF NEW.status <> 'cancelada' AND t.status <> 'cancelado' THEN
    INSERT INTO public.movimentacoes_financeiras
      (empresa_id, loja_id, centro_custo_id, categoria_id, tipo, origem, origem_id,
       descricao, valor, data_movimentacao, forma_pagamento, status)
    VALUES (t.empresa_id, t.loja_id, t.centro_custo_id, t.categoria_id,
       CASE WHEN t.tipo='pagar' THEN 'saida' ELSE 'entrada' END,
       'parcela', NEW.id,
       t.descricao || ' — parcela ' || NEW.numero || '/' || t.num_parcelas,
       CASE WHEN NEW.status IN ('paga','parcial') THEN NEW.valor_pago ELSE NEW.valor END,
       COALESCE(NEW.data_pagamento, NEW.data_vencimento),
       NEW.forma_pagamento,
       CASE WHEN NEW.status = 'paga' THEN 'confirmado' ELSE 'previsto' END);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mirror_parcela
AFTER INSERT OR UPDATE OR DELETE ON public.titulo_parcelas
FOR EACH ROW EXECUTE FUNCTION public.mirror_parcela_to_mov();

-- ============ status do título a partir das parcelas ============
CREATE OR REPLACE FUNCTION public.recalc_titulo_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titulo uuid; v_abertas int; v_pagas int; v_total int;
BEGIN
  v_titulo := COALESCE(NEW.titulo_id, OLD.titulo_id);
  SELECT COUNT(*) FILTER (WHERE status IN ('aberta','parcial')),
         COUNT(*) FILTER (WHERE status = 'paga'),
         COUNT(*) FILTER (WHERE status <> 'cancelada')
    INTO v_abertas, v_pagas, v_total
  FROM public.titulo_parcelas WHERE titulo_id = v_titulo;

  UPDATE public.titulos_financeiros SET status = CASE
      WHEN status = 'cancelado' THEN 'cancelado'
      WHEN v_total = 0 THEN 'aberto'
      WHEN v_abertas = 0 THEN 'quitado'
      WHEN v_pagas > 0 THEN 'parcial'
      ELSE 'aberto' END
  WHERE id = v_titulo;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_recalc_titulo_status
AFTER INSERT OR UPDATE OR DELETE ON public.titulo_parcelas
FOR EACH ROW EXECUTE FUNCTION public.recalc_titulo_status();