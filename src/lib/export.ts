import type { Customer } from "./store";

function esc(v: string | number | undefined) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ledgerToCsv(customers: Customer[]): string {
  const rows: string[] = [
    ["Customer", "Phone", "Type", "Date", "Items", "Total", "Paid", "Balance", "Due Date", "Signed"].join(","),
  ];
  for (const c of customers) {
    for (const t of c.transactions) {
      rows.push(
        [
          esc(c.name),
          esc(c.phone),
          "Order",
          esc(t.createdAt.slice(0, 10)),
          esc(t.items),
          esc(t.total),
          esc(t.paid),
          esc(t.balance),
          esc(t.dueDate),
          t.signature ? "Yes" : "No",
        ].join(","),
      );
    }
    for (const p of c.payments) {
      rows.push(
        [esc(c.name), esc(c.phone), "Payment", esc(p.createdAt.slice(0, 10)), "", "", esc(p.amount), "", "", ""].join(","),
      );
    }
  }
  return rows.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
