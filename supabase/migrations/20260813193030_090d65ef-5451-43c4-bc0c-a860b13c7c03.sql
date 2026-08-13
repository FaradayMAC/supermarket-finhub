ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS data_fim_experiencia date;

UPDATE public.funcionarios
SET data_fim_experiencia = data_admissao + 90
WHERE data_fim_experiencia IS NULL AND data_admissao IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.suspensoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suspensoes TO authenticated;
GRANT ALL ON public.suspensoes TO service_role;

ALTER TABLE public.suspensoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suspensoes_select" ON public.suspensoes
FOR SELECT TO authenticated
USING (
  public.has_module_access(auth.uid(), 'contracheque')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = suspensoes.funcionario_id AND public.loja_permitida(f.loja_id)
  )
);

CREATE POLICY "suspensoes_write" ON public.suspensoes
FOR ALL TO authenticated
USING (
  public.has_module_access(auth.uid(), 'contracheque')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = suspensoes.funcionario_id AND public.loja_permitida(f.loja_id)
  )
)
WITH CHECK (
  public.has_module_access(auth.uid(), 'contracheque')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = suspensoes.funcionario_id AND public.loja_permitida(f.loja_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_suspensoes_func ON public.suspensoes(funcionario_id, data_inicio);

CREATE TRIGGER update_suspensoes_updated_at
BEFORE UPDATE ON public.suspensoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();