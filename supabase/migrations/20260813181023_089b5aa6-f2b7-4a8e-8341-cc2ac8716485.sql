-- 1. Tabelas de módulos e permissões
CREATE TABLE public.modulos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  grupo text NOT NULL,
  ordem int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.modulos TO authenticated;
GRANT ALL ON public.modulos TO service_role;
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usuario_modulos (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo_id text NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, modulo_id)
);
GRANT SELECT ON public.usuario_modulos TO authenticated;
GRANT ALL ON public.usuario_modulos TO service_role;
ALTER TABLE public.usuario_modulos ENABLE ROW LEVEL SECURITY;

INSERT INTO public.modulos (id, nome, grupo, ordem) VALUES
  ('vendas','Vendas','Financeiro',10),
  ('compras','Compras','Financeiro',20),
  ('despesas','Despesas','Financeiro',30),
  ('caixa','Caixa','Financeiro',40),
  ('titulos','A pagar/receber','Financeiro',50),
  ('conciliacao','Conciliação','Financeiro',60),
  ('impostos','Impostos','Financeiro',70),
  ('metas','Metas','Financeiro',80),
  ('indicadores','Indicadores','Relatórios',10),
  ('dre','DRE','Relatórios',20),
  ('comparativo','Comparativo','Relatórios',30),
  ('funcionarios','Funcionários','Pessoas (RH)',10),
  ('cargos','Cargos','Pessoas (RH)',20),
  ('faltas_rh','Faltas RH','Pessoas (RH)',30),
  ('contracheque','Contra cheque','Pessoas (RH)',40),
  ('rescisao','Rescisão','Pessoas (RH)',50),
  ('prestadores','Prestadoras','Pessoas (RH)',60),
  ('lojas','Lojas','Administração',10),
  ('usuarios','Usuários','Administração',20);

-- 2. Admin master
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_master boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET admin_master = true
 WHERE lower(email) = 'pauloaraujo.viasupermercados@gmail.com';
CREATE UNIQUE INDEX one_admin_master ON public.profiles ((admin_master)) WHERE admin_master = true;

-- 3. Funções de acesso
CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND admin_master = true)
$$;

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND admin_master = true)
    OR EXISTS (
      SELECT 1 FROM public.usuario_modulos um
      JOIN public.profiles p ON p.id = um.usuario_id
      WHERE um.usuario_id = _user_id AND um.modulo_id = _modulo AND p.approved = true
    )
$$;

-- loja permitida: admin master e usuários sem loja vinculada veem tudo;
-- usuário vinculado a uma loja só enxerga a própria
CREATE OR REPLACE FUNCTION public.loja_permitida(_loja_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.admin_master OR p.loja_id IS NULL OR p.loja_id = _loja_id OR _loja_id IS NULL
       FROM public.profiles p WHERE p.id = auth.uid()),
    false)
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_master(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.loja_permitida(uuid) FROM anon;

-- RLS das próprias tabelas de permissão
CREATE POLICY modulos_select ON public.modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY modulos_write ON public.modulos FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));

CREATE POLICY usuario_modulos_select ON public.usuario_modulos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_module_access(auth.uid(), 'usuarios'));
CREATE POLICY usuario_modulos_write ON public.usuario_modulos FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'usuarios') AND NOT public.is_admin_master(usuario_id))
  WITH CHECK (public.has_module_access(auth.uid(), 'usuarios') AND NOT public.is_admin_master(usuario_id));

-- 4. Substituição das políticas antigas
DROP POLICY IF EXISTS afastamentos_select ON public.afastamentos_inss;
DROP POLICY IF EXISTS afastamentos_write ON public.afastamentos_inss;
CREATE POLICY afastamentos_select ON public.afastamentos_inss FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'faltas_rh'));
CREATE POLICY afastamentos_write ON public.afastamentos_inss FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'faltas_rh'))
  WITH CHECK (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'faltas_rh'));

DROP POLICY IF EXISTS "Admins podem ler o log de auditoria" ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'usuarios'));

DROP POLICY IF EXISTS cargos_select_auth ON public.cargos;
DROP POLICY IF EXISTS cargos_write_gestao ON public.cargos;
CREATE POLICY cargos_select ON public.cargos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY cargos_write ON public.cargos FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'cargos')) WITH CHECK (public.has_module_access(auth.uid(),'cargos'));

DROP POLICY IF EXISTS "categorias modify" ON public.categorias_despesa;
DROP POLICY IF EXISTS "categorias select" ON public.categorias_despesa;
CREATE POLICY categorias_select ON public.categorias_despesa FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY categorias_write ON public.categorias_despesa FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'despesas')) WITH CHECK (public.has_module_access(auth.uid(),'despesas'));

DROP POLICY IF EXISTS "cc modify" ON public.centros_custo;
DROP POLICY IF EXISTS "cc select" ON public.centros_custo;
CREATE POLICY cc_select ON public.centros_custo FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY cc_write ON public.centros_custo FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'despesas')) WITH CHECK (public.has_module_access(auth.uid(),'despesas'));

DROP POLICY IF EXISTS cofre_delete ON public.cofre_movimentacoes;
DROP POLICY IF EXISTS cofre_insert ON public.cofre_movimentacoes;
DROP POLICY IF EXISTS cofre_select ON public.cofre_movimentacoes;
DROP POLICY IF EXISTS cofre_update ON public.cofre_movimentacoes;
CREATE POLICY cofre_select ON public.cofre_movimentacoes FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'caixa') AND public.loja_permitida(loja_id));
CREATE POLICY cofre_write ON public.cofre_movimentacoes FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'caixa') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'caixa') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS compras_delete ON public.compras_mercadoria;
DROP POLICY IF EXISTS compras_insert ON public.compras_mercadoria;
DROP POLICY IF EXISTS compras_select ON public.compras_mercadoria;
DROP POLICY IF EXISTS compras_update ON public.compras_mercadoria;
CREATE POLICY compras_select ON public.compras_mercadoria FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(loja_id));
CREATE POLICY compras_write ON public.compras_mercadoria FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS compras_itens_select ON public.compras_mercadoria_itens;
DROP POLICY IF EXISTS compras_itens_write ON public.compras_mercadoria_itens;
CREATE POLICY compras_itens_select ON public.compras_mercadoria_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(c.loja_id)));
CREATE POLICY compras_itens_write ON public.compras_mercadoria_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(c.loja_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.compras_mercadoria c WHERE c.id = compra_id
    AND public.has_module_access(auth.uid(),'compras') AND public.loja_permitida(c.loja_id)));

DROP POLICY IF EXISTS "Admin e controladoria editam configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Logados podem ler configuracoes" ON public.configuracoes;
CREATE POLICY configuracoes_select ON public.configuracoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY configuracoes_write ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'cargos')) WITH CHECK (public.has_module_access(auth.uid(),'cargos'));

DROP POLICY IF EXISTS convenio_select ON public.convenio_funcionario;
DROP POLICY IF EXISTS convenio_write ON public.convenio_funcionario;
CREATE POLICY convenio_select ON public.convenio_funcionario FOR SELECT TO authenticated
  USING ((public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'funcionarios')) AND public.loja_permitida(loja_id));
CREATE POLICY convenio_write ON public.convenio_funcionario FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'contracheque') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'contracheque') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "despesas delete" ON public.despesas;
DROP POLICY IF EXISTS "despesas insert" ON public.despesas;
DROP POLICY IF EXISTS "despesas select" ON public.despesas;
DROP POLICY IF EXISTS "despesas update" ON public.despesas;
CREATE POLICY despesas_select ON public.despesas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'despesas') AND public.loja_permitida(loja_id));
CREATE POLICY despesas_write ON public.despesas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'despesas') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'despesas') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "empresas modify" ON public.empresas;
DROP POLICY IF EXISTS "empresas select" ON public.empresas;
CREATE POLICY empresas_select ON public.empresas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY empresas_write ON public.empresas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'lojas')) WITH CHECK (public.has_module_access(auth.uid(),'lojas'));

DROP POLICY IF EXISTS extratos_delete ON public.extratos_bancarios;
DROP POLICY IF EXISTS extratos_insert ON public.extratos_bancarios;
DROP POLICY IF EXISTS extratos_select ON public.extratos_bancarios;
DROP POLICY IF EXISTS extratos_update ON public.extratos_bancarios;
CREATE POLICY extratos_select ON public.extratos_bancarios FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'conciliacao') AND public.loja_permitida(loja_id));
CREATE POLICY extratos_write ON public.extratos_bancarios FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'conciliacao') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'conciliacao') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS faltas_rh_select ON public.faltas_rh;
DROP POLICY IF EXISTS faltas_rh_write ON public.faltas_rh;
CREATE POLICY faltas_rh_select ON public.faltas_rh FOR SELECT TO authenticated
  USING ((public.has_module_access(auth.uid(),'faltas_rh') OR public.has_module_access(auth.uid(),'contracheque')) AND public.loja_permitida(loja_id));
CREATE POLICY faltas_rh_write ON public.faltas_rh FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'faltas_rh') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'faltas_rh') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "faltas modify" ON public.faltas_rh_legado;
DROP POLICY IF EXISTS "faltas select" ON public.faltas_rh_legado;
CREATE POLICY faltas_legado_select ON public.faltas_rh_legado FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'faltas_rh') AND public.loja_permitida(loja_id));
CREATE POLICY faltas_legado_write ON public.faltas_rh_legado FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'faltas_rh') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'faltas_rh') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS ferias_gozadas_select ON public.ferias_gozadas;
DROP POLICY IF EXISTS ferias_gozadas_write ON public.ferias_gozadas;
CREATE POLICY ferias_gozadas_select ON public.ferias_gozadas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = funcionario_id AND public.loja_permitida(f.loja_id))
    AND (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'rescisao') OR public.has_module_access(auth.uid(),'funcionarios')));
CREATE POLICY ferias_gozadas_write ON public.ferias_gozadas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'rescisao'))
  WITH CHECK (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'rescisao'));

DROP POLICY IF EXISTS fgts_saques_select ON public.fgts_saques;
DROP POLICY IF EXISTS fgts_saques_write ON public.fgts_saques;
CREATE POLICY fgts_saques_select ON public.fgts_saques FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = funcionario_id AND public.loja_permitida(f.loja_id))
    AND (public.has_module_access(auth.uid(),'rescisao') OR public.has_module_access(auth.uid(),'funcionarios')));
CREATE POLICY fgts_saques_write ON public.fgts_saques FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'rescisao')) WITH CHECK (public.has_module_access(auth.uid(),'rescisao'));

DROP POLICY IF EXISTS "folha modify" ON public.folha_pagamento;
DROP POLICY IF EXISTS "folha select" ON public.folha_pagamento;
CREATE POLICY folha_select ON public.folha_pagamento FOR SELECT TO authenticated
  USING (public.loja_permitida(loja_id)
    AND (public.has_module_access(auth.uid(),'contracheque') OR public.has_module_access(auth.uid(),'funcionarios') OR public.has_module_access(auth.uid(),'rescisao')));
CREATE POLICY folha_write ON public.folha_pagamento FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'contracheque') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'contracheque') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS fornecedores_select ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_write ON public.fornecedores;
CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fornecedores_write ON public.fornecedores FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'compras') OR public.has_module_access(auth.uid(),'despesas'))
  WITH CHECK (public.has_module_access(auth.uid(),'compras') OR public.has_module_access(auth.uid(),'despesas'));

DROP POLICY IF EXISTS "func delete" ON public.funcionarios;
DROP POLICY IF EXISTS "func insert" ON public.funcionarios;
DROP POLICY IF EXISTS "func select" ON public.funcionarios;
DROP POLICY IF EXISTS "func update" ON public.funcionarios;
CREATE POLICY funcionarios_select ON public.funcionarios FOR SELECT TO authenticated
  USING (public.loja_permitida(loja_id) AND (
    public.has_module_access(auth.uid(),'funcionarios') OR public.has_module_access(auth.uid(),'contracheque')
    OR public.has_module_access(auth.uid(),'faltas_rh') OR public.has_module_access(auth.uid(),'rescisao')
    OR public.has_module_access(auth.uid(),'prestadores')));
CREATE POLICY funcionarios_write ON public.funcionarios FOR ALL TO authenticated
  USING (public.loja_permitida(loja_id) AND (public.has_module_access(auth.uid(),'funcionarios') OR public.has_module_access(auth.uid(),'rescisao')))
  WITH CHECK (public.loja_permitida(loja_id) AND (public.has_module_access(auth.uid(),'funcionarios') OR public.has_module_access(auth.uid(),'rescisao')));

DROP POLICY IF EXISTS "imp modify" ON public.impostos;
DROP POLICY IF EXISTS "imp select" ON public.impostos;
CREATE POLICY impostos_select ON public.impostos FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'impostos') AND public.loja_permitida(loja_id));
CREATE POLICY impostos_write ON public.impostos FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'impostos') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'impostos') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "lojas modify" ON public.lojas;
DROP POLICY IF EXISTS "lojas select" ON public.lojas;
CREATE POLICY lojas_select ON public.lojas FOR SELECT TO authenticated USING (public.loja_permitida(id));
CREATE POLICY lojas_write ON public.lojas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'lojas')) WITH CHECK (public.has_module_access(auth.uid(),'lojas'));

DROP POLICY IF EXISTS "metas modify" ON public.metas;
DROP POLICY IF EXISTS "metas select" ON public.metas;
CREATE POLICY metas_select ON public.metas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'metas') AND public.loja_permitida(loja_id));
CREATE POLICY metas_write ON public.metas FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'metas') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'metas') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "mov modify" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "mov select" ON public.movimentacoes_financeiras;
CREATE POLICY mov_select ON public.movimentacoes_financeiras FOR SELECT TO authenticated
  USING (public.loja_permitida(loja_id) AND (
    public.has_module_access(auth.uid(),'caixa') OR public.has_module_access(auth.uid(),'dre')
    OR public.has_module_access(auth.uid(),'indicadores') OR public.has_module_access(auth.uid(),'comparativo')));
CREATE POLICY mov_write ON public.movimentacoes_financeiras FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'caixa') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'caixa') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "perdas delete scoped" ON public.perdas_estoque;
DROP POLICY IF EXISTS "perdas insert scoped" ON public.perdas_estoque;
DROP POLICY IF EXISTS "perdas update scoped" ON public.perdas_estoque;
DROP POLICY IF EXISTS "perdas view scoped" ON public.perdas_estoque;
CREATE POLICY perdas_select ON public.perdas_estoque FOR SELECT TO authenticated
  USING ((public.has_module_access(auth.uid(),'compras') OR public.has_module_access(auth.uid(),'caixa')) AND public.loja_permitida(loja_id));
CREATE POLICY perdas_write ON public.perdas_estoque FOR ALL TO authenticated
  USING ((public.has_module_access(auth.uid(),'compras') OR public.has_module_access(auth.uid(),'caixa')) AND public.loja_permitida(loja_id))
  WITH CHECK ((public.has_module_access(auth.uid(),'compras') OR public.has_module_access(auth.uid(),'caixa')) AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "das modify" ON public.prestador_das_mensal;
DROP POLICY IF EXISTS "das select" ON public.prestador_das_mensal;
CREATE POLICY das_select ON public.prestador_das_mensal FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores'));
CREATE POLICY das_write ON public.prestador_das_mensal FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores')) WITH CHECK (public.has_module_access(auth.uid(),'prestadores'));

DROP POLICY IF EXISTS "rateio modify" ON public.prestador_das_rateio;
DROP POLICY IF EXISTS "rateio select" ON public.prestador_das_rateio;
CREATE POLICY rateio_select ON public.prestador_das_rateio FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores') AND public.loja_permitida(loja_id));
CREATE POLICY rateio_write ON public.prestador_das_rateio FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores')) WITH CHECK (public.has_module_access(auth.uid(),'prestadores'));

DROP POLICY IF EXISTS "prestadores modify" ON public.prestadores_servico;
DROP POLICY IF EXISTS "prestadores select" ON public.prestadores_servico;
CREATE POLICY prestadores_select ON public.prestadores_servico FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores') OR public.has_module_access(auth.uid(),'funcionarios'));
CREATE POLICY prestadores_write ON public.prestadores_servico FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'prestadores')) WITH CHECK (public.has_module_access(auth.uid(),'prestadores'));

DROP POLICY IF EXISTS produtos_select ON public.produtos;
DROP POLICY IF EXISTS produtos_write ON public.produtos;
CREATE POLICY produtos_select ON public.produtos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY produtos_write ON public.produtos FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'compras')) WITH CHECK (public.has_module_access(auth.uid(),'compras'));

DROP POLICY IF EXISTS "admin delete profile" ON public.profiles;
DROP POLICY IF EXISTS "admin insert profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "view own profile or admin" ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_module_access(auth.uid(),'usuarios'));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(),'usuarios') AND admin_master = false);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (public.has_module_access(auth.uid(),'usuarios') AND NOT public.is_admin_master(id)))
  WITH CHECK (id = auth.uid() OR (public.has_module_access(auth.uid(),'usuarios') AND NOT public.is_admin_master(id)));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(),'usuarios') AND NOT public.is_admin_master(id));

DROP POLICY IF EXISTS titulos_select ON public.titulos_financeiros;
DROP POLICY IF EXISTS titulos_write ON public.titulos_financeiros;
CREATE POLICY titulos_select ON public.titulos_financeiros FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(),'titulos') AND public.loja_permitida(loja_id));
CREATE POLICY titulos_write ON public.titulos_financeiros FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'titulos') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'titulos') AND public.loja_permitida(loja_id));

DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "read own role" ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_module_access(auth.uid(),'usuarios'));
CREATE POLICY user_roles_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));

DROP POLICY IF EXISTS "usuarios admin only" ON public.usuarios;
CREATE POLICY usuarios_all ON public.usuarios FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'usuarios')) WITH CHECK (public.has_module_access(auth.uid(),'usuarios'));

DROP POLICY IF EXISTS vendas_delete ON public.vendas_diarias;
DROP POLICY IF EXISTS vendas_insert ON public.vendas_diarias;
DROP POLICY IF EXISTS vendas_select ON public.vendas_diarias;
DROP POLICY IF EXISTS vendas_update ON public.vendas_diarias;
CREATE POLICY vendas_select ON public.vendas_diarias FOR SELECT TO authenticated
  USING (public.loja_permitida(loja_id) AND (
    public.has_module_access(auth.uid(),'vendas') OR public.has_module_access(auth.uid(),'caixa')
    OR public.has_module_access(auth.uid(),'dre') OR public.has_module_access(auth.uid(),'indicadores')
    OR public.has_module_access(auth.uid(),'comparativo')));
CREATE POLICY vendas_write ON public.vendas_diarias FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(),'vendas') AND public.loja_permitida(loja_id))
  WITH CHECK (public.has_module_access(auth.uid(),'vendas') AND public.loja_permitida(loja_id));