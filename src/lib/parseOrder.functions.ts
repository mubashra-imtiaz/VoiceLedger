import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const Input = z.object({ text: z.string().min(1).max(2000) });

export type ParsedOrder = {
  customerName: string;
  items: string;
  total: number;
  paid: number;
  balance: number;
  dueDate?: string;
};

function getApiKey(): string {
  let key =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY;

  if (key) return key;

  try {
    for (const filename of [".env", ".env.local"]) {
      const envPath = path.resolve(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match =
          content.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m) ||
          content.match(/^\s*VITE_GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match && match[1]?.trim()) {
          key = match[1].trim().replace(/^["']|["']$/g, "");
          if (key) break;
        }
      }
    }
  } catch {
    // ignore fs errors
  }

  return key || "";
}

const SYSTEM = `You extract structured order info for a shopkeeper's ledger from free-form text in English, Urdu, Hindi, or Roman Urdu. The user may write in ANY style. Extract:
- customer_name (string): buyer's name. If missing, use "Customer".
- items (string): concise description of items with quantities, e.g. "3kg flour, 2 eggs".
- total_amount (number): total price in PKR. 0 if unknown.
- amount_paid (number): amount already paid. 0 if none/unknown.
- remaining_balance (number): total_amount - amount_paid (never negative). Prefer explicit balance if stated.
- due_date (string): ISO date YYYY-MM-DD if a due date is expressed (today, tomorrow, kal, Friday, "in 3 days", or explicit date). Empty string if none.`;

export const parseOrderAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ParsedOrder> => {
    const key = getApiKey();
    if (!key) {
      throw new Error("Missing GEMINI_API_KEY in environment (.env)");
    }

    // Query Google AI Studio for available models supported by key
    let discoveredModels: string[] = [];
    try {
      const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const modelsRes = await fetch(modelsUrl, {
        headers: { "x-goog-api-key": key },
      });
      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        discoveredModels = (modelsJson?.models || [])
          .filter((m: { supportedGenerationMethods?: string[] }) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m: { name?: string }) => String(m.name || "").replace(/^models\//, ""))
          .filter((id: string): id is string => Boolean(id));
      }
    } catch {
      // Ignore discovery errors
    }

    const preferredModel = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL;
    const candidates = Array.from(
      new Set(
        [
          preferredModel,
          ...discoveredModels,
          "gemini-1.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash-8b",
          "gemini-2.5-flash",
        ].filter((x): x is string => Boolean(x))
      )
    );

    const today = new Date().toISOString().slice(0, 10);
    let res: Response | null = null;
    let lastErrorMsg = "";

    for (const model of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${SYSTEM}\nToday is ${today}.\n\nOrder text to parse:\n"${data.text}"`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                customer_name: { type: "STRING" },
                items: { type: "STRING" },
                total_amount: { type: "NUMBER" },
                amount_paid: { type: "NUMBER" },
                remaining_balance: { type: "NUMBER" },
                due_date: { type: "STRING" },
              },
              required: ["customer_name", "items", "total_amount", "amount_paid", "remaining_balance"],
            },
          },
        }),
      });

      if (response.ok) {
        res = response;
        break;
      }

      const body = await response.text().catch(() => "");
      let cleanMsg = body;
      try {
        const jsonErr = JSON.parse(body);
        cleanMsg = jsonErr.error?.message || jsonErr.message || body;
      } catch {
        // keep raw body
      }

      if (response.status === 429 || cleanMsg.includes("Quota exceeded") || cleanMsg.includes("quota")) {
        lastErrorMsg = "Gemini API free quota/rate limit reached";
      } else {
        lastErrorMsg = `Gemini (${response.status}): ${cleanMsg.slice(0, 150)}`;
      }

      continue;
    }

    if (!res || !res.ok) {
      throw new Error(lastErrorMsg || "Failed to reach Google Gemini API");
    }

    const json = await res.json();
    const rawContent: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) throw new Error("Gemini returned no content");

    // Clean markdown code blocks (e.g. ```json ... ```) and extra control characters
    let cleanJson = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    // Fallback regex to match raw JSON object syntax
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }

    const total = Number(parsed.total_amount) || 0;
    const paid = Number(parsed.amount_paid) || 0;
    const balance = Math.max(
      0,
      Number(parsed.remaining_balance ?? total - paid) || 0,
    );
    const due = String(parsed.due_date || "").trim();

    return {
      customerName: String(parsed.customer_name || "Customer").trim() || "Customer",
      items: String(parsed.items || "").trim(),
      total,
      paid,
      balance,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined,
    };
  });