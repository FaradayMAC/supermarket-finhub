-- 1. prestadores_servico
DROP POLICY IF EXISTS "auth read prestadores" ON public.prestadores_servico;
DROP POLICY IF EXISTS "auth write prestadores" ON public.prestadores_servico;
CREATE POLICY "prestadores select" ON public.prestadores_servico FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "prestadores modify" ON public.prestadores_servico FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- 2. prestador_das_mensal
DROP POLICY IF EXISTS "auth read das" ON public.prestador_das_mensal;
DROP POLICY IF EXISTS "auth write das" ON public.prestador_das_mensal;
CREATE POLICY "das select" ON public.prestador_das_mensal FOR SELECT TO authenticated
  USING (public.can_view_all());
CREATE POLICY "das modify" ON public.prestador_das_mensal FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- 3. prestador_das_rateio
DROP POLICY IF EXISTS "auth read rateio" ON public.prestador_das_rateio;
DROP POLICY IF EXISTS "auth write rateio" ON public.prestador_das_rateio;
CREATE POLICY "rateio select" ON public.prestador_das_rateio FOR SELECT TO authenticated
  USING (public.can_view_all() OR public.is_manager_of(loja_id));
CREATE POLICY "rateio modify" ON public.prestador_das_rateio FOR ALL TO authenticated
  USING (public.can_edit_all()) WITH CHECK (public.can_edit_all());

-- 4. user_roles: own rows only, admins see all
DROP POLICY IF EXISTS "authenticated read roles" ON public.user_roles;
CREATE POLICY "read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 5. usuarios: admin only
DROP POLICY IF EXISTS "open_all_usuarios" ON public.usuarios;
CREATE POLICY "usuarios admin only" ON public.usuarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.usuarios FROM anon;

-- 6. categorias_despesa: authenticated only
DROP POLICY IF EXISTS "categorias select" ON public.categorias_despesa;
CREATE POLICY "categorias select" ON public.categorias_despesa FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.categorias_despesa FROM anon;

-- 7. Lock down SECURITY DEFINER functions from direct API execution
REVOKE EXECUTE ON FUNCTION public.recalc_das_rateio(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_das_rateio_prestador(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_compra_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_despesa_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_folha_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_imposto_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_titulo_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mirror_venda_to_mov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_compra_total() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_profile_approval_on_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_das_mensal_rateio() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_func_rateio() FROM anon, authenticated, public;

-- helper predicates used inside RLS: keep for authenticated, block anonymous
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_all() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_all() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_loja() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_manager_of(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_loja() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of(uuid) TO authenticated;