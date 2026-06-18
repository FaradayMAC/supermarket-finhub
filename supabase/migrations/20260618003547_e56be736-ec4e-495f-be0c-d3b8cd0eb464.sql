
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- LOJAS
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  gerente TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lojas TO anon, authenticated;
GRANT ALL ON public.lojas TO service_role;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_lojas" ON public.lojas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_lojas_updated BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CATEGORIAS DE DESPESA
CREATE TABLE public.categorias_despesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'operacional', -- operacional, administrativo, marketing, manutencao, outros
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_despesa TO anon, authenticated;
GRANT ALL ON public.categorias_despesa TO service_role;
ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_categorias" ON public.categorias_despesa FOR ALL USING (true) WITH CHECK (true);

-- DESPESAS
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data_competencia DATE NOT NULL,
  centro_custo TEXT,
  status TEXT NOT NULL DEFAULT 'pago', -- pago, pendente, cancelado
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_despesas_loja ON public.despesas(loja_id);
CREATE INDEX idx_despesas_data ON public.despesas(data_competencia);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO anon, authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_despesas" ON public.despesas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_despesas_updated BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FUNCIONARIOS
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT,
  salario_base NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (salario_base >= 0),
  encargos NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (encargos >= 0),
  beneficios NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (beneficios >= 0),
  data_admissao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_funcionarios_loja ON public.funcionarios(loja_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO anon, authenticated;
GRANT ALL ON public.funcionarios TO service_role;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all_funcionarios" ON public.funcionarios FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_funcionarios_updated BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: categorias padrão
INSERT INTO public.categorias_despesa (nome, tipo) VALUES
  ('Aluguel', 'operacional'),
  ('Energia Elétrica', 'operacional'),
  ('Água', 'operacional'),
  ('Internet/Telefonia', 'operacional'),
  ('Manutenção', 'manutencao'),
  ('Limpeza', 'operacional'),
  ('Segurança', 'operacional'),
  ('Marketing', 'marketing'),
  ('Material de Escritório', 'administrativo'),
  ('Impostos', 'administrativo'),
  ('Outros', 'outros');
