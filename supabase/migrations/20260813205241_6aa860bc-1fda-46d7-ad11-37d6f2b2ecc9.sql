CREATE TABLE public.atestados_medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  dias integer NOT NULL CHECK (dias > 0),
  cid text NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atestados_medicos TO authenticated;
GRANT ALL ON public.atestados_medicos TO service_role;

ALTER TABLE public.atestados_medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atestados_medicos_select" ON public.atestados_medicos
FOR SELECT TO authenticated
USING (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = atestados_medicos.funcionario_id
      AND public.loja_permitida(f.loja_id)
  )
);

CREATE POLICY "atestados_medicos_write" ON public.atestados_medicos
FOR ALL TO authenticated
USING (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = atestados_medicos.funcionario_id
      AND public.loja_permitida(f.loja_id)
  )
)
WITH CHECK (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = atestados_medicos.funcionario_id
      AND public.loja_permitida(f.loja_id)
  )
);

CREATE INDEX idx_atestados_medicos_func_cid ON public.atestados_medicos (funcionario_id, cid, data_inicio);

CREATE TRIGGER update_atestados_medicos_updated_at
BEFORE UPDATE ON public.atestados_medicos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();