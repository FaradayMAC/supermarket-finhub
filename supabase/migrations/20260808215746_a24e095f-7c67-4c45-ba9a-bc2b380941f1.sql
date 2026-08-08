-- remove modelo anterior de parcelas (vazio)
ALTER TABLE public.despesas DROP COLUMN IF EXISTS parcela_id;
DROP TRIGGER IF EXISTS trg_mirror_parcela ON public.titulo_parcelas;
DROP TRIGGER IF EXISTS trg_recalc_titulo_status ON public.titulo_parcelas;
DROP TABLE IF EXISTS public.titulo_parcelas;
DROP FUNCTION IF EXISTS public.mirror_parcela_to_mov();
DROP FUNCTION IF EXISTS public.recalc_titulo_status();

-- título = uma parcela de um documento, separado do lançamento contábil
ALTER TABLE public.titulos_financeiros
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS cliente_ref text,
  ADD COLUMN IF NOT EXISTS valor numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_vencimento date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento_previsto date,
  ADD COLUMN IF NOT EXISTS data_pagamento_efetivo date,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS numero_parcela integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_parcelas integer NOT NULL DEFAULT 1;

ALTER TABLE public.titulos_financeiros
  DROP COLUMN IF EXISTS valor_total,
  DROP COLUMN IF EXISTS num_parcelas;

ALTER TABLE public.titulos_financeiros DROP CONSTRAINT IF EXISTS titulos_financeiros_status_check;
ALTER TABLE public.titulos_financeiros
  ADD CONSTRAINT titulos_financeiros_status_check
  CHECK (status IN ('aberto','parcial','pago','atrasado','cancelado'));

ALTER TABLE public.titulos_financeiros
  ADD CONSTRAINT titulos_financeiros_origem_check
  CHECK (origem IN ('manual','despesa','compra','imposto','folha','venda_cartao'));

CREATE INDEX IF NOT EXISTS idx_titulos_venc ON public.titulos_financeiros(data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_titulos_origem ON public.titulos_financeiros(origem, origem_id);

-- despesa pode apontar para o título gerado
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS titulo_id uuid REFERENCES public.titulos_financeiros(id) ON DELETE SET NULL;

-- espelho no fluxo de caixa (lançamento contábil)
CREATE OR REPLACE FUNCTION public.mirror_titulo_to_mov()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.movimentacoes_financeiras WHERE origem='titulo' AND origem_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM public.movimentacoes_financeiras WHERE origem='titulo' AND origem_id = NEW.id;

  IF NEW.status <> 'cancelado' THEN
    INSERT INTO public.movimentacoes_financeiras
      (empresa_id, loja_id, centro_custo_id, categoria_id, tipo, origem, origem_id,
       descricao, valor, data_movimentacao, forma_pagamento, status)
    VALUES (NEW.empresa_id, NEW.loja_id, NEW.centro_custo_id, NEW.categoria_id,
       CASE WHEN NEW.tipo='pagar' THEN 'saida' ELSE 'entrada' END,
       'titulo', NEW.id,
       NEW.descricao || CASE WHEN NEW.total_parcelas > 1
         THEN ' — parcela ' || NEW.numero_parcela || '/' || NEW.total_parcelas ELSE '' END,
       CASE WHEN NEW.status IN ('pago','parcial') THEN NEW.valor_pago ELSE NEW.valor END,
       COALESCE(NEW.data_pagamento_efetivo, NEW.data_pagamento_previsto, NEW.data_vencimento),
       NEW.forma_pagamento,
       CASE WHEN NEW.status = 'pago' THEN 'confirmado' ELSE 'previsto' END);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_titulo ON public.titulos_financeiros;
CREATE TRIGGER trg_mirror_titulo
AFTER INSERT OR UPDATE OR DELETE ON public.titulos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.mirror_titulo_to_mov();

-- marca automaticamente como atrasado quando vencido e não pago
CREATE OR REPLACE FUNCTION public.set_titulo_atraso()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pago','cancelado') THEN
    IF NEW.data_vencimento < CURRENT_DATE THEN
      NEW.status := 'atrasado';
    ELSIF NEW.status = 'atrasado' THEN
      NEW.status := CASE WHEN NEW.valor_pago > 0 THEN 'parcial' ELSE 'aberto' END;
    END IF;
  END IF;
  IF NEW.status = 'pago' AND NEW.data_pagamento_efetivo IS NULL THEN
    NEW.data_pagamento_efetivo := CURRENT_DATE;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_titulo_atraso ON public.titulos_financeiros;
CREATE TRIGGER trg_titulo_atraso
BEFORE INSERT OR UPDATE ON public.titulos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.set_titulo_atraso();