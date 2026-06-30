
-- Table to hold rateio results
CREATE TABLE public.prestador_das_rateio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  das_id uuid NOT NULL REFERENCES public.prestador_das_mensal(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES public.prestadores_servico(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  valor_das numeric(14,2) NOT NULL DEFAULT 0,
  folha_unidade numeric(14,2) NOT NULL DEFAULT 0,
  folha_total numeric(14,2) NOT NULL DEFAULT 0,
  percentual numeric(8,5) NOT NULL DEFAULT 0,
  valor_rateado numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (das_id, loja_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_das_rateio TO authenticated;
GRANT ALL ON public.prestador_das_rateio TO service_role;

ALTER TABLE public.prestador_das_rateio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read rateio" ON public.prestador_das_rateio
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write rateio" ON public.prestador_das_rateio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_das_rateio_prestador_comp ON public.prestador_das_rateio(prestador_id, competencia);
CREATE INDEX idx_das_rateio_loja ON public.prestador_das_rateio(loja_id);

CREATE TRIGGER trg_das_rateio_updated
  BEFORE UPDATE ON public.prestador_das_rateio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Core recalculation function for a (das_id) row
CREATE OR REPLACE FUNCTION public.recalc_das_rateio(_das_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador uuid;
  v_competencia date;
  v_valor numeric(14,2);
  v_total numeric(14,2);
BEGIN
  SELECT prestador_id, competencia, valor
    INTO v_prestador, v_competencia, v_valor
  FROM public.prestador_das_mensal WHERE id = _das_id;

  IF v_prestador IS NULL THEN
    DELETE FROM public.prestador_das_rateio WHERE das_id = _das_id;
    RETURN;
  END IF;

  -- Compute folha total per loja for active funcionarios of this prestador
  WITH base AS (
    SELECT loja_id,
           SUM(COALESCE(salario_base,0) + COALESCE(valor_extra_salarial,0)) AS folha
    FROM public.funcionarios
    WHERE prestador_id = v_prestador AND ativo = true AND loja_id IS NOT NULL
    GROUP BY loja_id
  ),
  tot AS (SELECT COALESCE(SUM(folha),0) AS total FROM base)
  SELECT total INTO v_total FROM tot;

  -- Remove old rateio for this das
  DELETE FROM public.prestador_das_rateio WHERE das_id = _das_id;

  IF v_total > 0 THEN
    INSERT INTO public.prestador_das_rateio
      (das_id, prestador_id, loja_id, competencia, valor_das, folha_unidade, folha_total, percentual, valor_rateado)
    SELECT _das_id, v_prestador, b.loja_id, v_competencia, v_valor,
           b.folha, v_total,
           ROUND((b.folha / v_total) * 100, 5),
           ROUND((b.folha / v_total) * v_valor, 2)
    FROM (
      SELECT loja_id,
             SUM(COALESCE(salario_base,0) + COALESCE(valor_extra_salarial,0)) AS folha
      FROM public.funcionarios
      WHERE prestador_id = v_prestador AND ativo = true AND loja_id IS NOT NULL
      GROUP BY loja_id
    ) b;
  END IF;
END $$;

-- Recalc all DAS for a given prestador (used when employees change)
CREATE OR REPLACE FUNCTION public.recalc_das_rateio_prestador(_prestador uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF _prestador IS NULL THEN RETURN; END IF;
  FOR r IN SELECT id FROM public.prestador_das_mensal WHERE prestador_id = _prestador LOOP
    PERFORM public.recalc_das_rateio(r.id);
  END LOOP;
END $$;

-- Trigger on prestador_das_mensal
CREATE OR REPLACE FUNCTION public.trg_das_mensal_rateio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.prestador_das_rateio WHERE das_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.recalc_das_rateio(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_das_mensal_rateio ON public.prestador_das_mensal;
CREATE TRIGGER trg_das_mensal_rateio
  AFTER INSERT OR UPDATE OR DELETE ON public.prestador_das_mensal
  FOR EACH ROW EXECUTE FUNCTION public.trg_das_mensal_rateio();

-- Trigger on funcionarios — recalc affected prestadores
CREATE OR REPLACE FUNCTION public.trg_func_rateio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_das_rateio_prestador(OLD.prestador_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_das_rateio_prestador(NEW.prestador_id);
    RETURN NEW;
  ELSE
    -- UPDATE: only if relevant fields changed
    IF (COALESCE(OLD.prestador_id::text,'') IS DISTINCT FROM COALESCE(NEW.prestador_id::text,''))
       OR (COALESCE(OLD.loja_id::text,'') IS DISTINCT FROM COALESCE(NEW.loja_id::text,''))
       OR (COALESCE(OLD.salario_base,0) IS DISTINCT FROM COALESCE(NEW.salario_base,0))
       OR (COALESCE(OLD.valor_extra_salarial,0) IS DISTINCT FROM COALESCE(NEW.valor_extra_salarial,0))
       OR (COALESCE(OLD.ativo,true) IS DISTINCT FROM COALESCE(NEW.ativo,true))
    THEN
      IF OLD.prestador_id IS NOT NULL THEN
        PERFORM public.recalc_das_rateio_prestador(OLD.prestador_id);
      END IF;
      IF NEW.prestador_id IS NOT NULL AND NEW.prestador_id IS DISTINCT FROM OLD.prestador_id THEN
        PERFORM public.recalc_das_rateio_prestador(NEW.prestador_id);
      ELSIF NEW.prestador_id IS NOT NULL AND OLD.prestador_id IS NULL THEN
        PERFORM public.recalc_das_rateio_prestador(NEW.prestador_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_func_rateio ON public.funcionarios;
CREATE TRIGGER trg_func_rateio
  AFTER INSERT OR UPDATE OR DELETE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.trg_func_rateio();

-- Backfill: recalc all existing DAS entries
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.prestador_das_mensal LOOP
    PERFORM public.recalc_das_rateio(r.id);
  END LOOP;
END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prestador_das_rateio;
