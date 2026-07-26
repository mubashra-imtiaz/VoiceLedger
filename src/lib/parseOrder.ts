// Lightweight local parser. Swap for Grok API later.
export type ParsedOrder = {
  customerName: string;
  items: string;
  total: number;
  paid: number;
  balance: number;
  dueDate?: string;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextWeekday(day: number): string {
  const now = new Date();
  const diff = (day - now.getDay() + 7) % 7 || 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function extractDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\btomorrow\b|\bkal\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/\btoday\b|\baaj\b/.test(lower)) return new Date().toISOString().slice(0, 10);
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) return nextWeekday(i);
  }
  const m = lower.match(/in\s+(\d+)\s+day/);
  if (m) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(m[1], 10));
    return d.toISOString().slice(0, 10);
  }
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  return undefined;
}

function extractName(text: string): string {
  // pattern: "<Name> bought/took/lena/liya..."
  const m = text.match(/^\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (m) return m[1];
  const m2 = text.match(/^\s*(\S+)/);
  return m2 ? m2[1] : "Customer";
}

export function parseOrder(text: string): ParsedOrder {
  const numbers = Array.from(text.matchAll(/(\d[\d,]*)/g)).map((m) => parseInt(m[1].replace(/,/g, ""), 10));
  const lower = text.toLowerCase();

  // total: number after "for" or "of" or largest number if only one
  let total = 0;
  let paid = 0;

  const totalMatch = lower.match(/for\s+(\d[\d,]*)/) || lower.match(/of\s+(\d[\d,]*)/) || lower.match(/(\d[\d,]*)\s*(?:rs|rupees|pkr)/);
  if (totalMatch) total = parseInt(totalMatch[1].replace(/,/g, ""), 10);

  const paidMatch = lower.match(/paid\s+(\d[\d,]*)/) || lower.match(/(\d[\d,]*)\s+diye/) || lower.match(/gave\s+(\d[\d,]*)/);
  if (paidMatch) paid = parseInt(paidMatch[1].replace(/,/g, ""), 10);

  if (!total && numbers.length >= 1) total = Math.max(...numbers);
  if (!paid && numbers.length >= 2) {
    const rest = numbers.filter((n) => n !== total);
    paid = rest.length ? Math.min(...rest) : 0;
  }

  const items = (text.match(/bought\s+(.+?)\s+for/i) || text.match(/took\s+(.+?)\s+for/i) || [, ""])[1] || text.split(",")[0] || "";

  const balanceMatch = lower.match(/balance\s+(?:of\s+)?(\d[\d,]*)/);
  const balance = balanceMatch ? parseInt(balanceMatch[1].replace(/,/g, ""), 10) : Math.max(0, total - paid);

  return {
    customerName: extractName(text),
    items: items.trim() || text.slice(0, 80),
    total,
    paid,
    balance,
    dueDate: extractDueDate(text),
  };
}
