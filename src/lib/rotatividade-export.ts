export type LinhaRotatividade = {
  nome: string;
  cargo: string;
  loja: string;
  admissao: string;
  desligamento: string;
  tempo: string;
  motivo: string;
};

const COLUNAS = [
  "Nome",
  "Cargo",
  "Loja",
  "Admissão",
  "Desligamento",
  "Tempo de casa",
  "Motivo",
] as const;

const linhaValores = (l: LinhaRotatividade) => [
  l.nome,
  l.cargo,
  l.loja,
  l.admissao,
  l.desligamento,
  l.tempo,
  l.motivo,
];

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function nomeArquivo(mes: string, loja: string, ext: string) {
  const slug = loja
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  return `rotatividade-${mes}-${slug}.${ext}`;
}

export function exportarRotatividadeCsv(params: {
  linhas: LinhaRotatividade[];
  mes: string;
  loja: string;
}) {
  const { linhas, mes, loja } = params;
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const conteudo = [
    [`Relatório de Rotatividade`],
    [`Competência: ${mes}`],
    [`Loja: ${loja}`],
    [],
    [...COLUNAS],
    ...linhas.map(linhaValores),
  ]
    .map((r) => r.map((c) => esc(String(c))).join(";"))
    .join("\r\n");
  baixar(
    new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" }),
    nomeArquivo(mes, loja, "csv"),
  );
}

export async function exportarRotatividadePdf(params: {
  linhas: LinhaRotatividade[];
  mes: string;
  loja: string;
  resumo: { motivo: string; qtd: number }[];
}) {
  const { linhas, mes, loja, resumo } = params;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 32;
  const R = W - 32;
  let y = 48;

  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text("Relatório de Rotatividade", L, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 15;
  doc.text(`Competência ${mes} · ${loja}`, L, y);
  doc.text(`${linhas.length} desligamento(s)`, R, y, { align: "right" });
  if (resumo.length) {
    y += 12;
    doc.setTextColor(110);
    doc.text(resumo.map((r) => `${r.qtd} · ${r.motivo}`).join("   |   "), L, y);
    doc.setTextColor(0);
  }

  y += 12;
  doc.setDrawColor(200).line(L, y, R, y);

  const larguras = [170, 130, 110, 80, 90, 100, 0];
  larguras[6] = R - L - larguras.slice(0, 6).reduce((a, b) => a + b, 0);

  const escreverLinha = (valores: string[], negrito: boolean) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal").setFontSize(8.5);
    let x = L;
    valores.forEach((v, i) => {
      const w = larguras[i]!;
      doc.text(doc.splitTextToSize(String(v ?? "—"), w - 8)[0] ?? "", x + 2, y);
      x += w;
    });
  };

  const cabecalho = () => {
    y += 18;
    doc.setFillColor(240, 240, 240).rect(L, y - 10, R - L, 15, "F");
    escreverLinha([...COLUNAS], true);
  };

  cabecalho();

  if (!linhas.length) {
    y += 20;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
    doc.text("Nenhum desligamento neste período.", L + 2, y);
  }

  for (const l of linhas) {
    y += 15;
    if (y > H - 50) {
      doc.addPage();
      y = 48;
      cabecalho();
      y += 0;
    }
    escreverLinha(linhaValores(l), false);
    doc.setDrawColor(232).line(L, y + 4, R, y + 4);
  }

  doc.save(nomeArquivo(mes, loja, "pdf"));
}
