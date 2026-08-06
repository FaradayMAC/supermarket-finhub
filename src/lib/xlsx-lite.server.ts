import { unzipSync, strFromU8 } from "fflate";

/**
 * Leitor minimalista de arquivos .xlsx (somente leitura de valores).
 * Evita dependências pesadas/vulneráveis e roda no runtime de borda.
 */

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const inner = m[1] ?? "";
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(inner))) text += unescapeXml(t[1] ?? "");
    out.push(text);
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let r: RegExpExecArray | null;
  while ((r = rowRe.exec(xml))) {
    const inner = r[1] ?? "";
    const cells: string[] = [];
    const cRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c: RegExpExecArray | null;
    while ((c = cRe.exec(inner))) {
      const attrs = c[1] ?? "";
      const body = c[2] ?? "";
      const refMatch = /r="([A-Z]+\d+)"/.exec(attrs);
      const idx = refMatch ? colIndex(refMatch[1]!) : cells.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      let value = "";
      if (type === "inlineStr") {
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let t: RegExpExecArray | null;
        while ((t = tRe.exec(body))) value += unescapeXml(t[1] ?? "");
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v != null) {
          value = type === "s" ? (shared[Number(v)] ?? "") : unescapeXml(v);
        }
      }
      while (cells.length < idx) cells.push("");
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

export type Workbook = { name: string; rows: string[][] }[];

export function readXlsx(data: Uint8Array): Workbook {
  const files = unzipSync(data);
  const shared = files["xl/sharedStrings.xml"]
    ? parseSharedStrings(strFromU8(files["xl/sharedStrings.xml"]!))
    : [];

  const relsXml = files["xl/_rels/workbook.xml.rels"]
    ? strFromU8(files["xl/_rels/workbook.xml.rels"]!)
    : "";
  const rels: Record<string, string> = {};
  const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let rel: RegExpExecArray | null;
  while ((rel = relRe.exec(relsXml))) {
    rels[rel[1]!] = rel[2]!.replace(/^\/?(xl\/)?/, "");
  }

  const wbXml = strFromU8(files["xl/workbook.xml"]!);
  const out: Workbook = [];
  const sheetRe = /<sheet\b([^>]*)\/?>/g;
  let s: RegExpExecArray | null;
  let fallback = 1;
  while ((s = sheetRe.exec(wbXml))) {
    const attrs = s[1] ?? "";
    const name = unescapeXml(/name="([^"]*)"/.exec(attrs)?.[1] ?? "");
    const rid = /r:id="([^"]+)"/.exec(attrs)?.[1];
    const target = (rid && rels[rid]) || `worksheets/sheet${fallback}.xml`;
    fallback++;
    const file = files[`xl/${target}`];
    if (!file) continue;
    out.push({ name, rows: parseSheet(strFromU8(file), shared) });
  }
  return out;
}

/** Converte serial de data do Excel para 'YYYY-MM-DD'. */
export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
