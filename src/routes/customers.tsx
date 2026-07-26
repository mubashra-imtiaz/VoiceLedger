import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useStore, type Customer } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { generateReceiptPng, downloadDataUrl } from "@/lib/receipt";
import { ledgerToCsv, downloadCsv } from "@/lib/export";
import { useShopName } from "@/lib/shop";
import {
  callLink,
  formatPkPhone,
  isValidPkPhone,
  normalizePkPhone,
  receiptMessage,
  reminderMessage,
  whatsappLink,
} from "@/lib/phone";
import { CheckCircle2, FileText, Phone, QrCode, Search, Trash2, User, MessageCircle, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customers — VoiceLedger" },
      { name: "description", content: "Search customer khaata, log payments, send WhatsApp reminders, and clear settled accounts." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { user, customers, totalBalance } = useStore();
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.navigate({ to: "/auth" });
  }, [user, router]);

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          (c.phone || "").includes(q.replace(/\D/g, "")),
      ),
    [customers, q],
  );
  const active = customers.find((c) => c.id === openId) || null;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <TopNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">{t("khaata")}</h1>
            <p className="text-sm text-muted-foreground">{t("customers")}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              downloadCsv(`voiceledger-ledger-${new Date().toISOString().slice(0, 10)}.csv`, ledgerToCsv(customers));
              toast.success(t("exported"));
            }}
            disabled={customers.length === 0}
          >
            <Download className="me-2 h-4 w-4" />
            {t("exportLedger")}
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchCustomers")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ps-10 h-11"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">{t("noCustomers")}</Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c) => {
              const bal = totalBalance(c);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenId(c.id)}
                    className="w-full rounded-2xl border bg-card p-4 text-start shadow-sm transition hover:border-primary hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.phone ? formatPkPhone(c.phone) : `${c.transactions.length} orders`}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className={`text-lg font-black tabular-nums ${bal > 0 ? "text-danger" : "text-success"}`}>
                          ₨ {bal.toLocaleString()}
                        </p>
                        {bal === 0 && (
                          <p className="flex items-center justify-end gap-1 text-xs font-semibold text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("settled")}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {active && <CustomerDetail customer={active} onClose={() => setOpenId(null)} />}
      </main>
    </div>
  );
}

function CustomerDetail({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { t } = useI18n();
  const { addPayment, deleteCustomer, totalBalance, updateCustomerPhone } = useStore();
  const shopName = useShopName();
  const [amt, setAmt] = useState("");
  const [phone, setPhone] = useState(customer.phone ? formatPkPhone(customer.phone) : "");
  const [qr, setQr] = useState<string | null>(null);
  const balance = totalBalance(customer);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amt);
    if (!n || n <= 0) return;
    addPayment(customer.id, n);
    setAmt("");
    toast.success(t("paymentLogged"));
  };

  const receiptText = () =>
    `${shopName}\n${t("receiptTitle")}\n${customer.name}${customer.phone ? ` (${formatPkPhone(customer.phone)})` : ""}\n` +
    customer.transactions
      .slice(0, 8)
      .map((tx) => `${tx.createdAt.slice(0, 10)} ${tx.items} — Total ${tx.total}, Paid ${tx.paid}, Balance ${tx.balance}`)
      .join("\n") +
    `\n${t("balance")}: PKR ${balance.toLocaleString()}`;

  const receipt = async () => {
    const dataUrl = await generateReceiptPng({
      shopName,
      customer,
      totalDue: balance,
      title: t("receiptTitle"),
      labels: {
        total: t("total"),
        paid: t("paid"),
        balance: t("balance"),
        dueDate: t("dueDate"),
        thanks: t("thankYou"),
        signature: t("signature"),
        scanLabel: t("scanReceipt"),
      },
      qrText: receiptText(),
    });
    downloadDataUrl(dataUrl, `receipt-${customer.name.replace(/\s+/g, "_")}.png`);
    toast.success(t("downloadReceipt"));
  };

  const showQr = async () => {
    setQr(await QRCode.toDataURL(receiptText(), { margin: 1, width: 420 }));
  };

  const openWhatsapp = (message: string) => {
    if (!customer.phone) return toast.error(t("addPhonePrompt"));
    const link = whatsappLink(customer.phone, message);
    if (!link) return toast.error(t("invalidPhone"));
    window.open(link, "_blank", "noopener");
  };

  const savePhone = async () => {
    const n = normalizePkPhone(phone);
    if (!n) return toast.error(t("invalidPhone"));
    await updateCustomerPhone(customer.id, n);
    setPhone(formatPkPhone(n));
    toast.success(t("phoneSaved"));
  };

  const dueTx = customer.transactions.find((tx) => tx.balance > 0 && tx.dueDate);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
          <DialogDescription>{t("history")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl bg-muted p-4">
          <span className="text-sm font-medium">{t("balance")}</span>
          <span className={`text-2xl font-black tabular-nums ${balance > 0 ? "text-danger" : "text-success"}`}>
            ₨ {balance.toLocaleString()}
          </span>
        </div>

        <div className="space-y-2 rounded-xl border p-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("phone")}</Label>
          <div className="flex gap-2">
            <Input
              inputMode="tel"
              placeholder={t("phoneHint")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={savePhone} disabled={!phone.trim()}>
              {t("save")}
            </Button>
          </div>
          {phone.trim() !== "" && !isValidPkPhone(phone) && (
            <p className="text-xs text-danger">{t("invalidPhone")}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openWhatsapp(receiptMessage({ name: customer.name, amount: balance, shopName }))}
            >
              <MessageCircle className="me-1.5 h-4 w-4" />
              {t("sendWhatsapp")}
            </Button>
            {balance > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  openWhatsapp(
                    reminderMessage({ name: customer.name, amount: balance, shopName, dueDate: dueTx?.dueDate }),
                  )
                }
              >
                <MessageCircle className="me-1.5 h-4 w-4" />
                {t("sendReminder")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const l = customer.phone && callLink(customer.phone);
                if (!l) return toast.error(t("addPhonePrompt"));
                window.location.href = l;
              }}
            >
              <Phone className="me-1.5 h-4 w-4" />
              {t("call")}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">{t("history")}</h3>
          {customer.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {customer.transactions.map((tx) => (
                <li key={tx.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.items}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.createdAt.slice(0, 10)}
                        {tx.dueDate && <> · {t("dueDate")}: {tx.dueDate}</>}
                      </p>
                      {tx.signature ? (
                        <div className="mt-2 inline-block rounded-lg border bg-white p-1">
                          <img src={tx.signature} alt={t("signature")} className="h-10 w-auto" />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-end text-xs">
                      <div className="tabular-nums">
                        <span className="text-muted-foreground">{t("total")}:</span> ₨ {tx.total}
                      </div>
                      <div className="tabular-nums">
                        <span className="text-muted-foreground">{t("paid")}:</span> ₨ {tx.paid}
                      </div>
                      <div className={`font-bold tabular-nums ${tx.balance > 0 ? "text-danger" : "text-success"}`}>
                        {t("balance")}: ₨ {tx.balance}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {balance > 0 && (
          <form onSubmit={submit} className="space-y-2 rounded-xl border p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("logPayment")}
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("amount")}
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                min="1"
              />
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={receipt} className="flex-1">
            <FileText className="me-2 h-4 w-4" />
            {t("generateReceipt")}
          </Button>
          <Button variant="outline" onClick={showQr} className="flex-1">
            <QrCode className="me-2 h-4 w-4" />
            {t("showQr")}
          </Button>
          {balance === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <Trash2 className="me-2 h-4 w-4" />
                  {t("deleteCustomer")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteCustomer")}?</AlertDialogTitle>
                  <AlertDialogDescription>{customer.name}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteCustomer(customer.id);
                      toast.success(t("customerDeleted"));
                      onClose();
                    }}
                  >
                    {t("confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {qr && (
          <Dialog open onOpenChange={(o) => !o && setQr(null)}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>{t("qrCode")}</DialogTitle>
                <DialogDescription>{t("scanReceipt")}</DialogDescription>
              </DialogHeader>
              <img src={qr} alt={t("qrCode")} className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
