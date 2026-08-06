import { createClient } from "@supabase/supabase-js";
import { readXlsx, excelSerialToDate } from "./xlsx-lite.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Planilhas compartilhadas no Drive (fonte da verdade do RH). */
export const PLANILHAS: { fileId: string; prestadorId: string; label: string }[] = [
  {
    label: "LIDER",
    fileId: "1KNCYmTenqIGdqrDlj8PtxreP1AgE9_peqQ_7QGgUZNU",
    prestadorId: "58fea9cd-048e-4695-8d89-529e2de13489",
  },
  {
    label: "PONTO CERTO",
    fileId: "1fKeBmDA92vIBc16ZGR20LPjlvJAB93jcPtV3aYRw5hQ",
    prestadorId: "81fa9bc4-839e-46b2-8f4e-d55489f7ef70",
  },
  {
    label: "TL",
    fileId: "1Zggj5_mLjAZb59B6nValG0pD03qvJkC8wO40-I0y0Nk",
    prestadorId: "f22c4cf4-8b40-4b4d-93bf-c99f9b8e79cf",
  },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const num = (v: string | undefined): number => {
  if (!v) return 0;
  const cleaned = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const n = Number(cleaned.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Percentual vindo da planilha: 0.2 => 20, 20 => 20. */
const pct = (v: string | undefined): number => {
  const n = num(v);
  if (n === 0) return 0;
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
};

function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return excelSerialToDate(Number(raw));
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return iso ? iso[1]! : null;
}

/** Escolhe a aba mais recente pelo padrão "MM.AA" no nome. */
export function pickLatestSheet<T extends { name: string }>(sheets: T[]): T | null {
  let best: T | null = null;
  let bestKey = -1;
  for (const s of sheets) {
    const m = /(\d{2})[.\/-](\d{2})/.exec(s.name);
    if (!m) continue;
    const key = Number(m[2]) * 100 + Number(m[1]);
    if (key > bestKey) {
      bestKey = key;
      best = s;
    }
  }
  return best ?? (sheets.length ? sheets[sheets.length - 1]! : null);
}

function findCol(header: string[], ...needles: string[]): number {
  return header.findIndex((h) => {
    const n = norm(h);
    return needles.every((needle) => n.includes(norm(needle)));
  });
}

async function downloadXlsx(fileId: string): Promise<Uint8Array> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!apiKey || !connKey) throw new Error("Conexão com o Google Drive não configurada");
  const res = await fetch(
    `${GATEWAY}/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": connKey,
      },
    },
  );
  if (!res.ok) throw new Error(`Falha ao ler planilha ${fileId}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export type SyncResult = {
  ok: boolean;
  competencia: string | null;
  atualizados: number;
  inseridos: number;
  desligados: number;
  ignorados: number;
  detalhes: { planilha: string; aba: string; atualizados: number; inseridos: number; desligados: number; ignorados: number }[];
  erros: string[];
};

export async function runDriveSync(): Promise<SyncResult> {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) throw new Error("Backend não configurado");
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: lojas, error: lojasErr } = await db.from("lojas").select("id, nome");
  if (lojasErr) throw lojasErr;
  const lojaByName = (lojas ?? []).map((l) => ({ id: l.id as string, n: norm(l.nome as string) }));
  const matchLoja = (departamento: string): string | null => {
    const d = norm(departamento);
    if (!d) return null;
    const hit = lojaByName.find((l) => d.includes(l.n));
    return hit ? hit.id : null;
  };

  const result: SyncResult = {
    ok: true,
    competencia: null,
    atualizados: 0,
    inseridos: 0,
    desligados: 0,
    ignorados: 0,
    detalhes: [],
    erros: [],
  };

  for (const planilha of PLANILHAS) {
    try {
      const wb = readXlsx(await downloadXlsx(planilha.fileId));
      const sheet = pickLatestSheet(wb);
      if (!sheet || sheet.rows.length < 2) throw new Error("aba não encontrada");
      const competencia = /(\d{2})[.\/-](\d{2})/.exec(sheet.name)?.[0] ?? null;
      if (competencia) result.competencia = competencia;

      const header = sheet.rows[0]!;
      const cNome = findCol(header, "Nome");
      const cDepto = findCol(header, "Departamento");
      const cSituacao = findCol(header, "Situa");
      const cAdmissao = findCol(header, "Admiss");
      const cSalario = findCol(header, "Sal", "Base");
      const cFuncao = findCol(header, "Fun\u00e7\u00e3o") >= 0 ? findCol(header, "Fun\u00e7\u00e3o") : findCol(header, "Cargo");
      const cDep = findCol(header, "Dependente");
      const cIns10 = findCol(header, "Insalubridade 10");
      const cIns20 = findCol(header, "Insalubridade 20");
      const cPeric = findCol(header, "Periculosidade");
      const cQuebra = findCol(header, "Quebra");
      const cVT = findCol(header, "Desconto V.T");
      const cObs = findCol(header, "Observa");

      const { data: atuais, error: atuaisErr } = await db
        .from("funcionarios")
        .select("id, nome, ativo")
        .eq("prestador_id", planilha.prestadorId);
      if (atuaisErr) throw atuaisErr;
      const existentes = new Map<string, { id: string; ativo: boolean }>();
      for (const f of atuais ?? [])
        existentes.set(norm(f.nome as string), { id: f.id as string, ativo: !!f.ativo });

      const vistos = new Set<string>();
      let atualizados = 0;
      let inseridos = 0;
      let ignorados = 0;

      for (const row of sheet.rows.slice(1)) {
        const nome = (row[cNome] ?? "").trim();
        if (!nome || norm(nome) === "NOME DO FUNCIONARIO") continue;
        const lojaId = matchLoja(row[cDepto] ?? "");
        if (!lojaId) {
          ignorados++;
          continue;
        }
        const insalubridade = Math.max(pct(cIns10 >= 0 ? row[cIns10] : ""), pct(cIns20 >= 0 ? row[cIns20] : ""));
        const payload = {
          nome,
          loja_id: lojaId,
          prestador_id: planilha.prestadorId,
          cargo: (cFuncao >= 0 ? row[cFuncao] : "") || null,
          salario_base: num(cSalario >= 0 ? row[cSalario] : ""),
          data_admissao: toDate(cAdmissao >= 0 ? row[cAdmissao] : ""),
          dependentes: Math.round(num(cDep >= 0 ? row[cDep] : "")),
          insalubridade_pct: insalubridade,
          periculosidade_pct: pct(cPeric >= 0 ? row[cPeric] : ""),
          quebra_caixa_pct: pct(cQuebra >= 0 ? row[cQuebra] : ""),
          desconto_vt: !!(cVT >= 0 && String(row[cVT] ?? "").trim()),
          situacao: (cSituacao >= 0 ? row[cSituacao] : "") || null,
          observacoes: (cObs >= 0 ? row[cObs] : "") || null,
          regime_tributario: "simples",
          ativo: true,
        };

        const key = norm(nome);
        vistos.add(key);
        const atual = existentes.get(key);
        if (atual) {
          const { error } = await db.from("funcionarios").update(payload).eq("id", atual.id);
          if (error) throw error;
          atualizados++;
        } else {
          const { error } = await db.from("funcionarios").insert(payload);
          if (error) throw error;
          inseridos++;
        }
      }

      const desligarIds = (atuais ?? [])
        .filter((f) => f.ativo && !vistos.has(norm(f.nome as string)))
        .map((f) => f.id as string);
      if (desligarIds.length) {
        const { error } = await db
          .from("funcionarios")
          .update({
            ativo: false,
            situacao: `Desligado (fora da planilha ${competencia ?? "atual"})`,
          })
          .in("id", desligarIds);
        if (error) throw error;
      }

      result.atualizados += atualizados;
      result.inseridos += inseridos;
      result.desligados += desligarIds.length;
      result.ignorados += ignorados;
      result.detalhes.push({
        planilha: planilha.label,
        aba: sheet.name.trim(),
        atualizados,
        inseridos,
        desligados: desligarIds.length,
        ignorados,
      });
    } catch (e) {
      result.ok = false;
      result.erros.push(`${planilha.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
