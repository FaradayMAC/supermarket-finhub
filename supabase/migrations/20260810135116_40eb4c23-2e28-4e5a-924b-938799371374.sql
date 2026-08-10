CREATE TABLE public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  salario_base numeric(14,2) NOT NULL DEFAULT 0,
  tem_periculosidade boolean NOT NULL DEFAULT false,
  periculosidade_pct numeric(6,2) NOT NULL DEFAULT 12,
  tem_quebra_caixa boolean NOT NULL DEFAULT false,
  quebra_caixa_pct numeric(6,2) NOT NULL DEFAULT 22,
  insalubridade_grau numeric(6,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargos TO authenticated;
GRANT ALL ON public.cargos TO service_role;

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargos_select_auth" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cargos_write_gestao" ON public.cargos FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

CREATE TRIGGER trg_cargos_updated BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS cargo_id uuid REFERENCES public.cargos(id) ON DELETE SET NULL;