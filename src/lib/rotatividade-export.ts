export type LinhaRotatividade = {
  nome: string;
  cargo: string;
  loja: string;
  admissao: string;
  desligamento: string;
  tempo: string;
  tipo: string;
  motivo: string;
};

const COLUNAS = [
  "Nome",
  "Cargo",
  "Loja",
  "Admissão",
  "Desligamento",
  "Tempo de casa",
  "Tipo de rescisão",
  "Motivo (observação)",
] as const;

const linhaValores = (l: LinhaRotatividade) => [
  l.nome,
  l.cargo,
  l.loja,
  l.admissao,
  l.desligamento,
  l.tempo,
  l.tipo,
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
  resumo: { motivo: string; qtd: number }[];
}) {
  const { linhas, mes, loja, resumo } = params;
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const total = linhas.length;
  const cabecalho: string[][] = [
    [`Relatório de Rotatividade`],
    [`Competência: ${mes}`],
    [`Loja: ${loja}`],
    [`Total de desligamentos: ${total}`],
  ];
  if (resumo.length) {
    cabecalho.push([`Resumo por motivo:`]);
    cabecalho.push(
      ...resumo.map((r) => [`  ${r.qtd} · ${r.motivo}`]),
    );
  }
  const conteudo = [
    ...cabecalho,
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
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Competência: ${mes}`, L, y);
  y += 12;
  doc.text(`Loja: ${loja}`, L, y);
  y += 12;
  doc.text(`Total de desligamentos: ${linhas.length}`, L, y);
  if (resumo.length) {
    y += 14;
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text("Resumo por motivo:", L, y);
    y += 12;
    doc.setFont("helvetica", "normal").setTextColor(110);
    const meio = L + (R - L) / 2;
    resumo.forEach((r, i) => {
      const col = i % 2;
      const x = col === 0 ? L : meio;
      if (col === 0 && i > 0) y += 13;
      doc.text(`${r.qtd} · ${r.motivo}`, x, y);
    });
    doc.setTextColor(0);
  }

  y += 12;
  doc.setDrawColor(200).line(L, y, R, y);

  const larguras = [150, 110, 95, 72, 80, 90, 110, 0];
  larguras[7] = R - L - larguras.slice(0, 7).reduce((a, b) => a + b, 0);

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
