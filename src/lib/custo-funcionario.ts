import { adicionaisDoCargo, SALARIO_MINIMO_FEDERAL, type CargoAdicionais } from "@/lib/cargos";
import { encargosRate, FGTS_PCT } from "@/lib/encargos";
import { calcSalarioFamilia } from "@/lib/salario-familia";


export type RegimeTributario = "simples" | "lucro_real";

/** Vínculos que definem a fonte real dos adicionais e do regime tributário. */
export type FonteAdicionais = CargoAdicionais & {
  cargo_id?: string | null;
  /** Join com `cargos` — fonte única dos adicionais quando há cargo_id. */
  cargos?: CargoAdicionais | null;
  /** Join com `lojas → empresas` — fonte única do regime tributário. */
  lojas?: {
    empresa_id?: string | null;
    empresas?: { regime_tributario?: string | null } | null;
  } | null;
};

/**
 * Adicionais legais do funcionário: vêm SEMPRE do cargo quando há cargo_id.
 * Os campos do próprio funcionário só valem no caso avulso (sem cargo).
 */
export function adicionaisFonte(f: FonteAdicionais): CargoAdicionais {
  if (f.cargo_id && f.cargos) return f.cargos;
  if (f.cargo_id) {
    return {
      tem_periculosidade: false,
      periculosidade_pct: 0,
      tem_quebra_caixa: false,
      motivo_insalubridade: "nenhum",
    };
  }
  return f;
}

/** Regime tributário do funcionário = regime da empresa dona da loja. */
export function regimeDoFuncionario(f: FonteAdicionais): RegimeTributario {
  return f.lojas?.empresas?.regime_tributario === "lucro_real" ? "lucro_real" : "simples";
}

export type FuncionarioCusto = FonteAdicionais & {
  salario_base: number | string;
  vale_transporte?: number | string;
  vale_alimentacao?: number | string;
  plano_saude?: number | string;
  plano_odontologico?: number | string;
  /** Somente leitura: o salário-família é sempre recalculado. */
  salario_familia?: number | string;
  dependentes?: number | string;
  valor_extra_salarial?: number | string;

  /**
   * false = vínculo registrado por prestadora (terceirizado): INSS patronal e
   * FGTS são obrigação da prestadora, então não entram no custo da empresa.
   */
  calcula_encargos?: boolean | null;
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

  const a = adicionaisDoCargo(adicionaisFonte(f), salario, salarioMinimoFederal);
  const comEncargos = f.calcula_encargos !== false;
  const rate = comEncargos ? encargosRate(regimeDoFuncionario(f)) : 0;
  const encargos = (salario + a.total) * rate;

  // FGTS estimado (8% do salário nominal) — referência de custo mensal esperado,
  // sem considerar faltas. O valor real do mês vive no Contracheque.
  // Nos regimes com encargos patronais (68%/28%) o FGTS já está embutido na taxa,
  // por isso ele só é somado ao total quando não há encargos aplicados.
  const fgtsEstimado = Math.round(salario * FGTS_PCT * 100) / 100;
  const fgtsNoTotal = comEncargos ? 0 : fgtsEstimado;

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
    comEncargos,
    encargos,
    rate,
    fgtsEstimado,
    fgtsNoTotal,
    beneficios: vt + va + ps + po,
    total: salario + a.total + encargos + fgtsNoTotal + vt + va + ps + po + sf + ve,
  };
}


/** Campos mínimos que toda tela precisa selecionar para calcular o custo ao vivo. */
export const CUSTO_SELECT =
  "id, loja_id, ativo, salario_base, vale_transporte, vale_alimentacao, plano_saude, plano_odontologico, salario_familia, valor_extra_salarial, calcula_encargos, cargo_id, motivo_insalubridade, tem_periculosidade, periculosidade_pct, tem_quebra_caixa, cargos(motivo_insalubridade, tem_periculosidade, periculosidade_pct, tem_quebra_caixa), lojas(empresa_id, empresas(regime_tributario))";
