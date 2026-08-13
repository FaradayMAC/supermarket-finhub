CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete')),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dados_antigos jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler o log de auditoria"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_log_tabela_data ON public.audit_log (tabela, created_at DESC);
CREATE INDEX idx_audit_log_usuario ON public.audit_log (usuario_id);
CREATE INDEX idx_audit_log_registro ON public.audit_log (registro_id);

CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_id := OLD.id; ELSE v_id := NEW.id; END IF;
  INSERT INTO public.audit_log (tabela, registro_id, acao, usuario_id, dados_antigos, dados_novos)
  VALUES (
    TG_TABLE_NAME,
    v_id,
    lower(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_audit_log() FROM anon, authenticated;

CREATE TRIGGER trg_audit_funcionarios AFTER INSERT OR UPDATE OR DELETE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_cargos AFTER INSERT OR UPDATE OR DELETE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_cofre AFTER INSERT OR UPDATE OR DELETE ON public.cofre_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_folha AFTER INSERT OR UPDATE OR DELETE ON public.folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_titulos AFTER INSERT OR UPDATE OR DELETE ON public.titulos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE OR REPLACE FUNCTION public.fn_audit_log_chave()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (tabela, registro_id, acao, usuario_id, dados_antigos, dados_novos)
  VALUES (
    TG_TABLE_NAME,
    NULL,
    lower(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_audit_log_chave() FROM anon, authenticated;

CREATE TRIGGER trg_audit_configuracoes AFTER INSERT OR UPDATE OR DELETE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_chave();