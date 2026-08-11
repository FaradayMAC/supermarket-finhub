CREATE TYPE public.motivo_insalubridade AS ENUM ('nenhum','asg_limpeza_terceirizada','frio_camara_fria');

ALTER TABLE public.cargos
  ADD COLUMN motivo_insalubridade public.motivo_insalubridade NOT NULL DEFAULT 'nenhum',
  ALTER COLUMN periculosidade_pct SET DEFAULT 30;

UPDATE public.cargos SET motivo_insalubridade =
  CASE WHEN insalubridade_grau >= 20 THEN 'frio_camara_fria'::public.motivo_insalubridade
       WHEN insalubridade_grau >= 10 THEN 'asg_limpeza_terceirizada'::public.motivo_insalubridade
       ELSE 'nenhum'::public.motivo_insalubridade END;

UPDATE public.cargos SET periculosidade_pct = 30 WHERE tem_periculosidade AND periculosidade_pct <> 30;

ALTER TABLE public.cargos
  DROP COLUMN insalubridade_grau,
  DROP COLUMN quebra_caixa_pct;

ALTER TABLE public.funcionarios
  ADD COLUMN motivo_insalubridade public.motivo_insalubridade NOT NULL DEFAULT 'nenhum',
  ADD COLUMN tem_periculosidade boolean NOT NULL DEFAULT false,
  ADD COLUMN tem_quebra_caixa boolean NOT NULL DEFAULT false;

UPDATE public.funcionarios SET
  motivo_insalubridade = CASE
    WHEN insalubridade_pct >= 20 THEN 'frio_camara_fria'::public.motivo_insalubridade
    WHEN insalubridade_pct >= 10 THEN 'asg_limpeza_terceirizada'::public.motivo_insalubridade
    ELSE 'nenhum'::public.motivo_insalubridade END,
  tem_quebra_caixa = (quebra_caixa_pct > 0),
  tem_periculosidade = (periculosidade_pct > 0),
  periculosidade_pct = CASE WHEN periculosidade_pct > 0 THEN 30 ELSE 0 END;

ALTER TABLE public.funcionarios
  DROP COLUMN insalubridade_pct,
  DROP COLUMN quebra_caixa_pct,
  DROP COLUMN encargos;