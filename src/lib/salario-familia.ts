// Salário-família — Lei 8.213/91, Art. 65-66.
// Valores vigentes em 2026 (Portaria Interministerial MPS/MF nº 13/2026).
// Benefício previdenciário: não integra base de FGTS, férias ou 13º.
export const SALARIO_FAMILIA_COTA = 67.54;
export const SALARIO_FAMILIA_TETO = 1980.38;

/**
 * Cota mensal devida: nº de dependentes elegíveis × cota, apenas quando a
 * remuneração fica dentro do teto. Não varia com faltas.
 */
export function calcSalarioFamilia(salarioBase: number, dependentes: number): number {
  const sal = Number(salarioBase) || 0;
  const dep = Math.max(0, Math.floor(Number(dependentes) || 0));
  if (sal > SALARIO_FAMILIA_TETO) return 0;
  return Math.round(dep * SALARIO_FAMILIA_COTA * 100) / 100;
}
