// Pakistani mobile number helpers.
// Accepts 0321 1234567, 03211234567, +92 321 1234567, 3211234567 …

export function digitsOnly(v: string) {
  return (v || "").replace(/\D/g, "");
}

/** Returns bare international digits (923211234567) or null when invalid. */
export function normalizePkPhone(input: string): string | null {
  let d = digitsOnly(input);
  if (!d) return null;
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  // now expect 3XXXXXXXXX (10 digits, mobile)
  if (!/^3\d{9}$/.test(d)) return null;
  return `92${d}`;
}

export function isValidPkPhone(input: string) {
  return normalizePkPhone(input) !== null;
}

/** Pretty local format: 0321 1234567 */
export function formatPkPhone(input: string): string {
  const n = normalizePkPhone(input);
  if (!n) return input;
  const local = `0${n.slice(2)}`;
  return `${local.slice(0, 4)} ${local.slice(4)}`;
}

export function whatsappLink(phone: string, message: string) {
  const n = normalizePkPhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string, message: string) {
  const n = normalizePkPhone(phone);
  if (!n) return null;
  return `sms:+${n}?&body=${encodeURIComponent(message)}`;
}

export function callLink(phone: string) {
  const n = normalizePkPhone(phone);
  if (!n) return null;
  return `tel:+${n}`;
}

export function reminderMessage(opts: {
  name: string;
  amount: number;
  shopName: string;
  dueDate?: string;
}) {
  const { name, amount, shopName, dueDate } = opts;
  return `Salam ${name}, this is a friendly reminder that your balance of Rs ${amount.toLocaleString()} at ${shopName} ${
    dueDate ? `was due on ${dueDate}` : "is pending"
  }. Please clear your dues at your earliest convenience. Shukriya!`;
}

export function receiptMessage(opts: { name: string; amount: number; shopName: string }) {
  return `Salam ${opts.name}, thank you for your order at ${opts.shopName}. Your outstanding balance is Rs ${opts.amount.toLocaleString()}.`;
}
