
CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_origem_uidx
  ON public.movimentacoes_financeiras (origem, origem_id)
  WHERE origem IS NOT NULL AND origem_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mirror_despesa_to_mov()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='despesa' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.movimentacoes_financeiras
    (empresa_id, loja_id, centro_custo_id, categoria_id, tipo, origem, origem_id,
     descricao, valor, data_movimentacao, forma_pagamento, status)
  VALUES
    (NEW.empresa_id, NEW.loja_id, NEW.centro_custo_id, NEW.categoria_id,
     'saida', 'despesa', NEW.id,
     COALESCE(NEW.descricao,'Despesa'), NEW.valor,
     COALESCE(NEW.data_pagamento, NEW.data_competencia),
     NEW.forma_pagamento,
     CASE WHEN NEW.status='pago' THEN 'confirmado' ELSE 'previsto' END)
  ON CONFLICT (origem, origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL
  DO UPDATE SET empresa_id=EXCLUDED.empresa_id, loja_id=EXCLUDED.loja_id,
    centro_custo_id=EXCLUDED.centro_custo_id, categoria_id=EXCLUDED.categoria_id,
    descricao=EXCLUDED.descricao, valor=EXCLUDED.valor,
    data_movimentacao=EXCLUDED.data_movimentacao, forma_pagamento=EXCLUDED.forma_pagamento,
    status=EXCLUDED.status, updated_at=now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_despesa ON public.despesas;
CREATE TRIGGER trg_mirror_despesa AFTER INSERT OR UPDATE OR DELETE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.mirror_despesa_to_mov();

CREATE OR REPLACE FUNCTION public.mirror_imposto_to_mov()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='imposto' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;
  DELETE FROM public.movimentacoes_financeiras WHERE origem='imposto' AND origem_id = NEW.id;
  IF NEW.status='pago' OR NEW.data_pagamento IS NOT NULL THEN
    INSERT INTO public.movimentacoes_financeiras
      (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
    VALUES (NEW.empresa_id, NEW.loja_id, 'saida', 'imposto', NEW.id,
       COALESCE(NEW.tipo,'Imposto') || COALESCE(' — ' || NEW.descricao,''),
       NEW.valor, COALESCE(NEW.data_pagamento, NEW.data_vencimento, NEW.competencia), 'confirmado');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_imposto ON public.impostos;
CREATE TRIGGER trg_mirror_imposto AFTER INSERT OR UPDATE OR DELETE ON public.impostos
FOR EACH ROW EXECUTE FUNCTION public.mirror_imposto_to_mov();

CREATE OR REPLACE FUNCTION public.mirror_folha_to_mov()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loja uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='folha' AND origem_id=OLD.id;
    RETURN OLD;
  END IF;
  DELETE FROM public.movimentacoes_financeiras WHERE origem='folha' AND origem_id=NEW.id;
  IF NEW.data_pagamento IS NOT NULL OR NEW.status IN ('paga','fechada','pago') THEN
    v_loja := NEW.loja_id;
    IF v_loja IS NULL THEN
      SELECT loja_id INTO v_loja FROM public.funcionarios WHERE id=NEW.funcionario_id;
    END IF;
    INSERT INTO public.movimentacoes_financeiras
      (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
    VALUES (NEW.empresa_id, v_loja, 'saida', 'folha', NEW.id,
       'Folha de pagamento — ' || to_char(NEW.competencia,'MM/YYYY'),
       COALESCE(NULLIF(NEW.custo_total,0), NEW.liquido),
       COALESCE(NEW.data_pagamento, NEW.competencia), 'confirmado');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_folha ON public.folha_pagamento;
CREATE TRIGGER trg_mirror_folha AFTER INSERT OR UPDATE OR DELETE ON public.folha_pagamento
FOR EACH ROW EXECUTE FUNCTION public.mirror_folha_to_mov();

INSERT INTO public.movimentacoes_financeiras
  (empresa_id, loja_id, centro_custo_id, categoria_id, tipo, origem, origem_id,
   descricao, valor, data_movimentacao, forma_pagamento, status)
SELECT d.empresa_id, d.loja_id, d.centro_custo_id, d.categoria_id,
  'saida','despesa', d.id, COALESCE(d.descricao,'Despesa'), d.valor,
  COALESCE(d.data_pagamento,d.data_competencia), d.forma_pagamento,
  CASE WHEN d.status='pago' THEN 'confirmado' ELSE 'previsto' END
FROM public.despesas d
ON CONFLICT (origem,origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL DO NOTHING;

INSERT INTO public.movimentacoes_financeiras
  (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
SELECT i.empresa_id, i.loja_id, 'saida','imposto', i.id,
  COALESCE(i.tipo,'Imposto') || COALESCE(' — '||i.descricao,''),
  i.valor, COALESCE(i.data_pagamento,i.data_vencimento,i.competencia), 'confirmado'
FROM public.impostos i
WHERE i.status='pago' OR i.data_pagamento IS NOT NULL
ON CONFLICT (origem,origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL DO NOTHING;

INSERT INTO public.movimentacoes_financeiras
  (empresa_id, loja_id, tipo, origem, origem_id, descricao, valor, data_movimentacao, status)
SELECT f.empresa_id, COALESCE(f.loja_id,fn.loja_id), 'saida','folha', f.id,
  'Folha de pagamento — '||to_char(f.competencia,'MM/YYYY'),
  COALESCE(NULLIF(f.custo_total,0),f.liquido),
  COALESCE(f.data_pagamento,f.competencia), 'confirmado'
FROM public.folha_pagamento f
LEFT JOIN public.funcionarios fn ON fn.id=f.funcionario_id
WHERE f.data_pagamento IS NOT NULL OR f.status IN ('paga','fechada','pago')
ON CONFLICT (origem,origem_id) WHERE origem IS NOT NULL AND origem_id IS NOT NULL DO NOTHING;

ALTER TABLE public.despesas REPLICA IDENTITY FULL;
ALTER TABLE public.impostos REPLICA IDENTITY FULL;
ALTER TABLE public.folha_pagamento REPLICA IDENTITY FULL;
ALTER TABLE public.movimentacoes_financeiras REPLICA IDENTITY FULL;
ALTER TABLE public.funcionarios REPLICA IDENTITY FULL;
ALTER TABLE public.metas REPLICA IDENTITY FULL;
ALTER TABLE public.lojas REPLICA IDENTITY FULL;
ALTER TABLE public.categorias_despesa REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['despesas','impostos','folha_pagamento','movimentacoes_financeiras','funcionarios','metas','lojas','categorias_despesa']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
