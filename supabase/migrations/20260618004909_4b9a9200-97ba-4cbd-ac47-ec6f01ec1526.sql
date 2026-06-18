
-- =========================================================
-- EMPRESAS
-- =========================================================
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO anon, authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_empresas ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USUARIOS (perfis do sistema - sem auth ainda)
-- =========================================================
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cargo TEXT,
  perfil TEXT NOT NULL DEFAULT 'operador', -- admin, gerente, operador, financeiro
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO anon, authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_usuarios ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- LOJAS (Unidades) - adiciona vínculo com empresa
-- =========================================================
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT;

-- =========================================================
-- FUNCIONARIOS - vínculo com empresa
-- =========================================================
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT;

-- =========================================================
-- CENTROS DE CUSTO
-- =========================================================
CREATE TABLE public.centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO anon, authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_centros_custo ON public.centros_custo FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CATEGORIAS DE DESPESA - vincular hierarquia
-- =========================================================
ALTER TABLE public.categorias_despesa
  ADD COLUMN IF NOT EXISTS categoria_pai_id UUID REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descricao TEXT;

-- =========================================================
-- DESPESAS - vincular centro de custo (FK) e empresa
-- =========================================================
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- =========================================================
-- IMPOSTOS
-- =========================================================
CREATE TABLE public.impostos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,            -- ICMS, PIS, COFINS, ISS, IRPJ, CSLL, INSS, etc.
  descricao TEXT,
  competencia DATE NOT NULL,     -- mês de referência
  base_calculo NUMERIC(14,2) NOT NULL DEFAULT 0,
  aliquota NUMERIC(7,4) NOT NULL DEFAULT 0,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, pago, atrasado
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impostos TO anon, authenticated;
GRANT ALL ON public.impostos TO service_role;
ALTER TABLE public.impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_impostos ON public.impostos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_impostos_updated BEFORE UPDATE ON public.impostos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FOLHA DE PAGAMENTO (por funcionário/competência)
-- =========================================================
CREATE TABLE public.folha_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,           -- mês/ano de referência
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  horas_extras NUMERIC(14,2) NOT NULL DEFAULT 0,
  comissoes NUMERIC(14,2) NOT NULL DEFAULT 0,
  beneficios NUMERIC(14,2) NOT NULL DEFAULT 0,
  inss NUMERIC(14,2) NOT NULL DEFAULT 0,
  fgts NUMERIC(14,2) NOT NULL DEFAULT 0,
  irrf NUMERIC(14,2) NOT NULL DEFAULT 0,
  outros_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  outros_encargos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_proventos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta', -- aberta, fechada, paga
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_pagamento TO anon, authenticated;
GRANT ALL ON public.folha_pagamento TO service_role;
ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_folha ON public.folha_pagamento FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_folha_updated BEFORE UPDATE ON public.folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- METAS
-- =========================================================
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,                  -- faturamento, despesa, cmv, lucro, ticket_medio
  descricao TEXT,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_meta NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_realizado NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento', -- em_andamento, atingida, nao_atingida
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO anon, authenticated;
GRANT ALL ON public.metas TO service_role;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_metas ON public.metas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_metas_updated BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- MOVIMENTACOES FINANCEIRAS (caixa: receitas e despesas consolidadas)
-- =========================================================
CREATE TABLE public.movimentacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,                  -- entrada, saida
  origem TEXT,                          -- venda, despesa, folha, imposto, outros
  origem_id UUID,                       -- id da entidade relacionada (despesa, folha, imposto)
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  data_movimentacao DATE NOT NULL,
  forma_pagamento TEXT,
  conta TEXT,
  status TEXT NOT NULL DEFAULT 'confirmado', -- confirmado, previsto, cancelado
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO anon, authenticated;
GRANT ALL ON public.movimentacoes_financeiras TO service_role;
ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all_movimentacoes ON public.movimentacoes_financeiras FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mov_updated BEFORE UPDATE ON public.movimentacoes_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ÍNDICES úteis
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_despesas_loja ON public.despesas(loja_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON public.despesas(data_competencia);
CREATE INDEX IF NOT EXISTS idx_funcionarios_loja ON public.funcionarios(loja_id);
CREATE INDEX IF NOT EXISTS idx_folha_competencia ON public.folha_pagamento(competencia);
CREATE INDEX IF NOT EXISTS idx_impostos_competencia ON public.impostos(competencia);
CREATE INDEX IF NOT EXISTS idx_mov_data ON public.movimentacoes_financeiras(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_mov_loja ON public.movimentacoes_financeiras(loja_id);
CREATE INDEX IF NOT EXISTS idx_metas_periodo ON public.metas(periodo_inicio, periodo_fim);
