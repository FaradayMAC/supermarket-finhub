ALTER TABLE public.folha_pagamento
  ADD COLUMN IF NOT EXISTS fechada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechada_por uuid;

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_desligamento date;

CREATE OR REPLACE FUNCTION public.block_folha_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'fechada' AND NOT public.has_role(auth.uid(),'admin') THEN
      RAISE EXCEPTION 'Competência fechada é somente leitura';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'fechada' AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Competência fechada é somente leitura';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_folha_fechada ON public.folha_pagamento;
CREATE TRIGGER trg_block_folha_fechada
  BEFORE UPDATE OR DELETE ON public.folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.block_folha_fechada();