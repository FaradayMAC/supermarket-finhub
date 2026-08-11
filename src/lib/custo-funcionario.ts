import { adicionaisDoCargo, SALARIO_MINIMO_FEDERAL, type CargoAdicionais } from "@/lib/cargos";
import { encargosRate } from "@/lib/encargos";

export type FuncionarioCusto = CargoAdicionais & {
  salario_base: number | string;
  vale_transporte?: number | string;
  vale_alimentacao?: number | string;
  plano_saude?: number | string;
  plano_odontologico?: number | string;
  salario_familia?: number | string;
  valor_extra_salarial?: number | string;
  regime_tributario?: string | null;
};

/**
 * Única função de custo do funcionário — sempre calculada ao vivo, nunca lida
 * de um valor congelado no cadastro.
 */
export function custoReal(
  f: FuncionarioCusto,
  salarioMinimoFederal: number = SALARIO_MINIMO_FEDERAL,
) {
  const salario = Number(f.salario_base) || 0;
  const vt = Number(f.vale_transporte) || 0;
  const va = Number(f.vale_alimentacao) || 0;
  const ps = Number(f.plano_saude) || 0;
  const po = Number(f.plano_odontologico) || 0;
  const sf = Number(f.salario_familia) || 0;
  const ve = Number(f.valor_extra_salarial) || 0;

  const a = adicionaisDoCargo(f, salario, salarioMinimoFederal);
  const rate = encargosRate(f.regime_tributario);
  const encargos = (salario + a.total) * rate;

  return {
    salario,
    vt,
    va,
    ps,
    po,
    sf,
    ve,
    detalheAdicionais: a,
    adicionais: a.total,
    encargos,
    rate,
    beneficios: vt + va + ps + po,
    total: salario + a.total + encargos + vt + va + ps + po + sf + ve,
  };
}

/** Campos mínimos que toda tela precisa selecionar para calcular o custo ao vivo. */
export const CUSTO_SELECT =
  "id, loja_id, ativo, salario_base, vale_transporte, vale_alimentacao, plano_saude, plano_odontologico, salario_familia, valor_extra_salarial, regime_tributario, motivo_insalubridade, tem_periculosidade, periculosidade_pct, tem_quebra_caixa";
