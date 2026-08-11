import { calcContracheque, type FuncionarioCC } from "@/lib/contracheque";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export type PdfFunc = FuncionarioCC & {
  id: string;
  nome: string;
  cargo: string | null;
  regime_tributario?: string;
};

export async function gerarContrachequePdf(params: {
  func: PdfFunc;
  loja: string;
  mes: string;
  faltas: number;
  convenio: number;
  salarioMinimoFederal?: number;
}) {
  const { func, loja, mes, faltas, convenio, salarioMinimoFederal } = params;
  const cc = calcContracheque(func, { mes, faltas, convenio, salarioMinimoFederal });
  const [ano, m] = mes.split("-");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const L = 40;
  const R = W - 40;
  let y = 50;

  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("Recibo de Pagamento de Salário", L, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 16;
  doc.text(`Competência ${m}/${ano}`, L, y);
  doc.text(loja, R, y, { align: "right" });

  y += 14;
  doc.setDrawColor(200).line(L, y, R, y);

  y += 20;
  doc.setFont("helvetica", "bold").setFontSize(11).text(func.nome, L, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 13;
  doc.text(`${func.cargo ?? "—"} · Regime: ${String(func.regime_tributario ?? "—")}`, L, y);
  y += 12;
  doc.text(
    `Dias úteis: ${cc.calendario.diasUteis} · Dias de repouso (DSR): ${cc.calendario.diasRepouso} · Faltas: ${cc.faltas}`,
    L,
    y,
  );

  const section = (titulo: string) => {
    y += 22;
    doc.setFillColor(240, 240, 240).rect(L, y - 11, R - L, 16, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).text(titulo, L + 6, y);
    doc.setFont("helvetica", "normal");
    y += 8;
  };

  const linha = (label: string, valor: number, negativo?: boolean) => {
    if (!valor) return;
    y += 14;
    doc.setFontSize(9);
    doc.text(label, L + 6, y);
    doc.text(`${negativo ? "- " : ""}${brl(Math.abs(valor))}`, R - 6, y, { align: "right" });
  };

  const total = (label: string, valor: number, negativo?: boolean) => {
    y += 16;
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(label, L + 6, y);
    doc.text(`${negativo ? "- " : ""}${brl(Math.abs(valor))}`, R - 6, y, { align: "right" });
    doc.setFont("helvetica", "normal");
  };

  section("Proventos");
  linha("Salário base", cc.salario);
  linha("Insalubridade", cc.insalubridade);
  linha("Periculosidade", cc.periculosidade);
  linha("Quebra de caixa", cc.quebraCaixa);
  linha("Valor extra salarial", cc.extra);
  linha("Salário-família", cc.salFamilia);
  total("Total de proventos", cc.proventos);

  section("Descontos");
  linha(`Faltas (${cc.faltas} dia(s))`, cc.descFaltas, true);
  linha(`DSR sobre faltas (${cc.dsrDias} dia(s))`, cc.descDsr, true);
  linha("Redução proporcional do valor extra", cc.descExtra, true);
  linha("INSS", cc.inss, true);
  linha("IRRF", cc.irrf, true);
  linha("Vale-transporte (6%)", cc.descontoVt, true);
  linha("Plano de saúde", cc.planoSaude, true);
  linha("Plano odontológico", cc.planoOdonto, true);
  linha("Convênio (compras na loja)", cc.convenio, true);
  total("Total de descontos", cc.totalDescontos, true);

  if (cc.va > 0 || cc.vt > 0) {
    section("Benefícios (proporcionais às faltas)");
    linha("Vale-alimentação", cc.vaLiquido);
    linha("Redução por faltas (VA)", cc.descVa, true);
    linha("Vale-transporte", cc.vtLiquido);
    linha("Redução por faltas (VT)", cc.descVtBeneficio, true);
  }

  y += 26;
  doc.setFillColor(235, 241, 250).rect(L, y - 13, R - L, 26, "F");
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Líquido a receber", L + 6, y + 4);
  doc.text(brl(cc.liquido), R - 6, y + 4, { align: "right" });

  y += 48;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(110);
  doc.text(
    "Cálculo conforme CLT e Lei 605/49, considerando feriados nacionais e estaduais do Espírito Santo.",
    L,
    y,
  );

  y += 60;
  doc.setTextColor(0).setFontSize(9);
  doc.line(L, y, L + 220, y);
  doc.text("Assinatura do funcionário", L, y + 12);
  doc.line(R - 220, y, R, y);
  doc.text("Assinatura da empresa", R - 220, y + 12);

  const slug = func.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  doc.save(`contracheque-${slug}-${mes}.pdf`);
}
