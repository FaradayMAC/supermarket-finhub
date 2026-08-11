// Encargos patronais por regime tributário.
// - Lucro Real/Presumido (CLT normal): INSS Patronal 20% + RAT/Terceiros ~8,5% +
//   FGTS 8% + provisões de férias+1/3 e 13º com encargos ≈ 68% do salário.
// - Simples Nacional: INSS patronal e terceiros recolhidos no DAS ≈ 28%.
export const ENCARGOS_RATE_LUCRO_REAL = 0.68;
export const ENCARGOS_RATE_SIMPLES = 0.28;

export function encargosRate(regime: string | null | undefined) {
  return regime === "lucro_real" ? ENCARGOS_RATE_LUCRO_REAL : ENCARGOS_RATE_SIMPLES;
}
