import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  filename: z.string(),
  fileBase64: z.string().min(10),
  mimeType: z.string(),
});

export type DasExtraido = {
  cnpj: string | null;
  razao_social: string | null;
  competencia: string | null; // YYYY-MM
  valor_total: number | null;
  data_vencimento: string | null; // YYYY-MM-DD
  numero_documento: string | null;
  observacoes: string | null;
};

/** Lê um documento DAS (PDF/imagem) e extrai os dados principais. */
export const parseDasDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<DasExtraido> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível: chave não configurada.");

    const dataUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
    const isPdf = data.mimeType.includes("pdf");

    const content: any[] = [
      {
        type: "text",
        text:
          "Este é um documento DAS (Simples Nacional). Extraia os dados e responda APENAS com JSON válido, sem markdown, no formato: " +
          '{"cnpj":"apenas digitos ou null","razao_social":string|null,"competencia":"YYYY-MM"|null,' +
          '"valor_total":number|null,"data_vencimento":"YYYY-MM-DD"|null,"numero_documento":string|null,"observacoes":string|null}. ' +
          "valor_total é o valor total do documento em reais (ponto como separador decimal). " +
          "observacoes pode conter o resumo dos tributos (INSS/CPP, IRPJ, CSLL, COFINS, PIS, ICMS, ISS) quando disponíveis.",
      },
      isPdf
        ? { type: "file", file: { filename: data.filename, file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`Falha ao ler o documento (${res.status})`);

    const json: any = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Não foi possível interpretar o documento.");

    const parsed = JSON.parse(match[0]);
    const num = (v: unknown) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    return {
      cnpj: parsed.cnpj ? String(parsed.cnpj).replace(/\D/g, "") : null,
      razao_social: parsed.razao_social ?? null,
      competencia: typeof parsed.competencia === "string" ? parsed.competencia.slice(0, 7) : null,
      valor_total: num(parsed.valor_total),
      data_vencimento: typeof parsed.data_vencimento === "string" ? parsed.data_vencimento.slice(0, 10) : null,
      numero_documento: parsed.numero_documento ? String(parsed.numero_documento) : null,
      observacoes: parsed.observacoes ? String(parsed.observacoes) : null,
    };
  });
