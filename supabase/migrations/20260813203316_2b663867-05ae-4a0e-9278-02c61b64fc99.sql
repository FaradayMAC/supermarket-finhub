CREATE TABLE public.atestados_acidente_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  dias_atestado integer NOT NULL CHECK (dias_atestado > 0),
  afastado_inss boolean NOT NULL DEFAULT false,
  numero_cat text,
  data_retorno date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atestados_acidente_func ON public.atestados_acidente_trabalho(funcionario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atestados_acidente_trabalho TO authenticated;
GRANT ALL ON public.atestados_acidente_trabalho TO service_role;

ALTER TABLE public.atestados_acidente_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acidente_select" ON public.atestados_acidente_trabalho
FOR SELECT TO authenticated
USING (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = funcionario_id AND public.loja_permitida(f.loja_id)
  )
);

CREATE POLICY "acidente_write" ON public.atestados_acidente_trabalho
FOR ALL TO authenticated
USING (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = funcionario_id AND public.loja_permitida(f.loja_id)
  )
)
WITH CHECK (
  public.has_module_access(auth.uid(), 'funcionarios')
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = funcionario_id AND public.loja_permitida(f.loja_id)
  )
);

CREATE TRIGGER trg_atestados_acidente_updated
BEFORE UPDATE ON public.atestados_acidente_trabalho
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();