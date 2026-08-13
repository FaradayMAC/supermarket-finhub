CREATE TABLE public.notificacoes_lidas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  data_evento date NOT NULL,
  lida_por uuid REFERENCES auth.users(id),
  lida_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, tipo, data_evento)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_lidas TO authenticated;
GRANT ALL ON public.notificacoes_lidas TO service_role;

ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver notificacoes lidas com acesso a funcionarios"
ON public.notificacoes_lidas FOR SELECT TO authenticated
USING (public.has_module_access(auth.uid(), 'funcionarios'));

CREATE POLICY "Gerenciar notificacoes lidas com acesso a funcionarios"
ON public.notificacoes_lidas FOR ALL TO authenticated
USING (public.has_module_access(auth.uid(), 'funcionarios'))
WITH CHECK (public.has_module_access(auth.uid(), 'funcionarios'));