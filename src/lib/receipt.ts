import QRCode from "qrcode";
import type { Customer } from "./store";
import { formatPkPhone } from "./phone";

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateReceiptPng(opts: {
  shopName: string;
  customer: Customer;
  totalDue: number;
  title: string;
  labels: { total: string; paid: string; balance: string; dueDate: string; thanks: string; signature?: string; scanLabel?: string };
  qrText?: string;
}): Promise<string> {
  const { shopName, customer, totalDue, title, labels, qrText } = opts;
  const w = 720;
  const lineH = 34;
  const txCount = Math.min(customer.transactions.length, 10);
  const h = 300 + txCount * lineH + 260;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#0f7a4c";
  ctx.fillRect(0, 0, w, 90);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText(shopName || "VoiceLedger", 30, 40);
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(title, 30, 68);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText(customer.name, 30, 130);
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(
    `${new Date().toLocaleString()}${customer.phone ? `  ·  ${formatPkPhone(customer.phone)}` : ""}`,
    30,
    152,
  );

  let y = 195;
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(30, y - 20);
  ctx.lineTo(w - 30, y - 20);
  ctx.stroke();
  ctx.fillStyle = "#374151";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText("Date", 30, y);
  ctx.fillText("Items", 150, y);
  ctx.fillText(labels.total, 440, y);
  ctx.fillText(labels.paid, 520, y);
  ctx.fillText(labels.balance, 610, y);
  y += 12;
  ctx.beginPath();
  ctx.moveTo(30, y);
  ctx.lineTo(w - 30, y);
  ctx.stroke();
  y += 22;

  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "#111827";
  for (const t of customer.transactions.slice(0, txCount)) {
    ctx.fillText(t.createdAt.slice(0, 10), 30, y);
    const it = (t.items || "").slice(0, 30);
    ctx.fillText(it, 150, y);
    ctx.fillText(String(t.total), 440, y);
    ctx.fillText(String(t.paid), 520, y);
    ctx.fillStyle = t.balance > 0 ? "#b91c1c" : "#0f7a4c";
    ctx.fillText(String(t.balance), 610, y);
    ctx.fillStyle = "#111827";
    y += lineH;
  }

  y += 20;
  ctx.beginPath();
  ctx.moveTo(30, y);
  ctx.lineTo(w - 30, y);
  ctx.stroke();
  y += 30;
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillStyle = totalDue > 0 ? "#b91c1c" : "#0f7a4c";
  ctx.fillText(`${labels.balance}: PKR ${totalDue.toLocaleString()}`, 30, y);

  const baseY = y + 24;

  // Signature (latest transaction that has one)
  const signed = customer.transactions.find((t) => t.signature)?.signature;
  if (signed) {
    const img = await loadImage(signed);
    if (img) {
      const sw = 240;
      const sh = Math.min(90, (img.height / img.width) * sw);
      ctx.drawImage(img, 30, baseY, sw, sh);
      ctx.strokeStyle = "#9ca3af";
      ctx.beginPath();
      ctx.moveTo(30, baseY + sh + 6);
      ctx.lineTo(30 + sw, baseY + sh + 6);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(labels.signature || "Customer signature", 30, baseY + sh + 24);
    }
  }

  // QR code
  if (qrText) {
    try {
      const qrUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 320 });
      const qr = await loadImage(qrUrl);
      if (qr) {
        const size = 130;
        ctx.drawImage(qr, w - 30 - size, baseY, size, size);
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px system-ui, sans-serif";
        const lbl = labels.scanLabel || "Scan for a copy";
        ctx.fillText(lbl, w - 30 - size, baseY + size + 18);
      }
    } catch {
      /* ignore QR failures */
    }
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = "italic 14px system-ui, sans-serif";
  ctx.fillText(labels.thanks, 30, h - 24);

  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
