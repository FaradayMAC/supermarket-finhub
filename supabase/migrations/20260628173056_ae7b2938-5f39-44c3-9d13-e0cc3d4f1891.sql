
-- =========================================
-- 1. profiles
-- =========================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2. roles
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin','diretoria','controladoria','gerente');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 3. helper functions (SECURITY DEFINER)
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_loja()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_view_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'diretoria')
      OR public.has_role(auth.uid(),'controladoria')
$$;

CREATE OR REPLACE FUNCTION public.can_edit_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'controladoria')
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_loja_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'gerente') AND _loja_id IS NOT NULL AND _loja_id = public.current_user_loja()
$$;

-- =========================================
-- 4. signup trigger: profile + promote pauloadm to admin
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname text;
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)));

  uname := lower(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  IF uname = 'pauloadm' OR lower(NEW.email) LIKE 'pauloadm@%' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 5. profiles RLS
-- =========================================
CREATE POLICY "view own profile or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.can_view_all());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =========================================
-- 6. user_roles RLS
-- =========================================
CREATE POLICY "authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- 7. Replace open policies on financial tables
-- =========================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lojas','despesas','funcionarios','folha_pagamento','impostos',
    'metas','centros_custo','movimentacoes_financeiras','categorias_despesa','empresas'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- drop existing policies
    FOR t IN SELECT polname FROM pg_policy WHERE polrelid = (quote_ident(t))::regclass LOOP
      NULL;
    END LOOP;
  END LOOP;
END$$;

-- Drop old open policies explicitly per table (names from prior migrations may vary; use catalog)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('lojas','despesas','funcionarios','folha_pagamento','impostos',
                        'metas','centros_custo','movimentacoes_financeiras','categorias_despesa','empresas')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END$$;

-- Tables WITH loja_id (gerente can edit own loja)
-- despesas, funcionarios, folha_pagamento (via funcionario.loja_id), impostos, metas, centros_custo, movimentacoes_financeiras
-- lojas: gerente can only view own; edits only admin/controladoria

-- LOJAS
CREATE POLICY "lojas select" ON public.lojas FOR SELECT TO authenticated
  USING (public.can_view_all() OR id = public.current_user_loja());
CREATE POLICY "lojas modify" ON public.lojas FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- EMPRESAS (only admin/controladoria/diretoria see; only admin/controladoria edit)
CREATE POLICY "empresas select" ON public.empresas FOR SELECT TO authenticated
  USING (public.can_view_all());
CREATE POLICY "empresas modify" ON public.empresas FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- CATEGORIAS_DESPESA (all authenticated read; only admin/controladoria edit)
CREATE POLICY "categorias select" ON public.categorias_despesa FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias modify" ON public.categorias_despesa FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- DESPESAS
CREATE POLICY "despesas select" ON public.despesas FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "despesas insert" ON public.despesas FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "despesas update" ON public.despesas FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "despesas delete" ON public.despesas FOR DELETE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id));

-- FUNCIONARIOS
CREATE POLICY "func select" ON public.funcionarios FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "func insert" ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "func update" ON public.funcionarios FOR UPDATE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
CREATE POLICY "func delete" ON public.funcionarios FOR DELETE TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id));

-- FOLHA (scoped via funcionario.loja_id)
CREATE POLICY "folha select" ON public.folha_pagamento FOR SELECT TO authenticated
  USING (public.can_view_all() OR EXISTS (
    SELECT 1 FROM public.funcionarios f WHERE f.id = folha_pagamento.funcionario_id
      AND public.is_manager_of(f.loja_id)));
CREATE POLICY "folha modify" ON public.folha_pagamento FOR ALL TO authenticated
  USING (public.can_edit_all() OR EXISTS (
    SELECT 1 FROM public.funcionarios f WHERE f.id = folha_pagamento.funcionario_id
      AND public.is_manager_of(f.loja_id)))
  WITH CHECK (public.can_edit_all() OR EXISTS (
    SELECT 1 FROM public.funcionarios f WHERE f.id = folha_pagamento.funcionario_id
      AND public.is_manager_of(f.loja_id)));

-- IMPOSTOS
CREATE POLICY "imp select" ON public.impostos FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "imp modify" ON public.impostos FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

-- METAS
CREATE POLICY "metas select" ON public.metas FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "metas modify" ON public.metas FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));

-- CENTROS_CUSTO
CREATE POLICY "cc select" ON public.centros_custo FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "cc modify" ON public.centros_custo FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- MOVIMENTACOES_FINANCEIRAS
CREATE POLICY "mov select" ON public.movimentacoes_financeiras FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "mov modify" ON public.movimentacoes_financeiras FOR ALL TO authenticated
  USING (public.can_edit_all() OR public.is_manager_of(loja_id))
  WITH CHECK (public.can_edit_all() OR public.is_manager_of(loja_id));
