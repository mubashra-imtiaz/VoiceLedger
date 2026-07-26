import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type Customer } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { parseOrder, type ParsedOrder } from "@/lib/parseOrder";
import { parseOrderAI } from "@/lib/parseOrder.functions";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Bell, Mic, MicOff, Sparkles, Users, Wallet, TrendingUp, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/signature-pad";
import { useShopName } from "@/lib/shop";
import { callLink, formatPkPhone, isValidPkPhone, normalizePkPhone, reminderMessage, whatsappLink } from "@/lib/phone";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — VoiceLedger" },
      { name: "description", content: "Track outstanding udhaar, today's vasooli, and add new orders with AI." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, customers, totalBalance, todaysRevenue, addOrder } = useStore();
  const { t, lang } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.navigate({ to: "/auth" });
  }, [user, router]);
  if (!user) return null;

  const outstanding = customers.reduce((s, c) => s + totalBalance(c), 0);
  const activeDebtors = customers.filter((c) => totalBalance(c) > 0).length;
  const revenue = todaysRevenue();

  const today = new Date().toISOString().slice(0, 10);
  const reminders = customers.flatMap((c) =>
    c.transactions
      .filter((tx) => tx.balance > 0 && tx.dueDate && tx.dueDate <= today)
      .map((tx) => ({ customer: c, tx })),
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <TopNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {reminders.length > 0 && <RemindersBanner count={reminders.length} />}

        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label={t("outstandingUdhaar")}
            value={`₨ ${outstanding.toLocaleString()}`}
            icon={<Wallet className="h-5 w-5" />}
            tone="danger"
          />
          <MetricCard
            label={t("revenueToday")}
            value={`₨ ${revenue.toLocaleString()}`}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="success"
          />
          <MetricCard
            label={t("activeDebtors")}
            value={String(activeDebtors)}
            icon={<Users className="h-5 w-5" />}
            tone="warning"
          />
        </section>

        <QuickAdd onCreate={addOrder} lang={lang} />

        <RemindersList reminders={reminders} />
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "danger" | "success" | "warning" }) {
  const toneMap = {
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tabular-nums">{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneMap[tone]}`}>{icon}</div>
      </div>
    </Card>
  );
}

function RemindersBanner({ count }: { count: number }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <Bell className="h-5 w-5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1">
        <span className="font-bold">{count}</span> {t("remindersDue")}
      </p>
    </div>
  );
}

function RemindersList({ reminders }: { reminders: { customer: Customer; tx: Customer["transactions"][number] }[] }) {
  const { t } = useI18n();
  const shopName = useShopName();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Bell className="h-4 w-4" /> {t("reminders")}
      </h2>
      {reminders.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("noReminders")}</p>
      ) : (
        <ul className="mt-3 divide-y">
          {reminders.map(({ customer, tx }) => {
            const overdue = tx.dueDate! < today;
            return (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {customer.name} — ₨ {tx.balance.toLocaleString()} {t("dueTodayAlert")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tx.items}
                    {customer.phone ? ` · ${formatPkPhone(customer.phone)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-semibold ${overdue ? "text-danger" : "text-warning"}`}>
                    {overdue ? t("overdue") : t("dueToday")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!customer.phone) return toast.error(t("addPhonePrompt"));
                      const link = whatsappLink(
                        customer.phone,
                        reminderMessage({
                          name: customer.name,
                          amount: tx.balance,
                          shopName,
                          dueDate: tx.dueDate,
                        }),
                      );
                      if (!link) return toast.error(t("invalidPhone"));
                      window.open(link, "_blank", "noopener");
                    }}
                  >
                    <MessageCircle className="me-1.5 h-4 w-4" />
                    {t("sendReminder")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const l = customer.phone && callLink(customer.phone);
                      if (!l) return toast.error(t("addPhonePrompt"));
                      window.location.href = l;
                    }}
                    aria-label={t("call")}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function QuickAdd({ onCreate, lang }: { onCreate: ReturnType<typeof useStore>["addOrder"]; lang: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedOrder | null>(null);
  const recogRef = useRef<any>(null);

  const startListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Speech recognition not supported in this browser");
    const r = new SR();
    r.lang = lang === "ur" ? "ur-PK" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      const txt = Array.from(e.results).map((x: any) => x[0].transcript).join("");
      setText(txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  };
  const stopListen = () => {
    recogRef.current?.stop();
    setListening(false);
  };

  const runAI = async () => {
    if (!text.trim() || processing) return;
    setProcessing(true);
    try {
      const result = await parseOrderAI({ data: { text } });
      setParsed(result);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "AI parsing failed";
      toast.error(`${msg} — using local parser fallback`);
      setParsed(parseOrder(text));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold">{t("quickAdd")}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("quickAddHint")}</p>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Textarea
            placeholder={t("typeOrSpeak")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="resize-none pe-14"
          />
          <button
            type="button"
            onClick={listening ? stopListen : startListen}
            className={`absolute bottom-2 end-2 grid h-10 w-10 place-items-center rounded-full transition ${
              listening ? "bg-danger text-danger-foreground animate-pulse" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            aria-label="Mic"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
        {listening && <p className="text-xs text-muted-foreground">{t("listening")}</p>}
        <Button onClick={runAI} className="w-full" size="lg" disabled={!text.trim() || processing}>
          <Sparkles className="me-2 h-4 w-4" />
          {processing ? t("processingAI") : t("processAI")}
        </Button>
      </div>

      {parsed && (
        <ConfirmModal
          parsed={parsed}
          onClose={() => setParsed(null)}
          onSave={(v, extra) => {
            onCreate(
              v.customerName,
              {
                items: v.items,
                total: v.total,
                paid: v.paid,
                dueDate: v.dueDate,
                signature: extra.signature,
              },
              extra.phone,
            );
            toast.success(t("added"));
            setParsed(null);
            setText("");
          }}
        />
      )}
    </Card>
  );
}

function ConfirmModal({
  parsed,
  onClose,
  onSave,
}: {
  parsed: ParsedOrder;
  onClose: () => void;
  onSave: (v: ParsedOrder, extra: { phone?: string; signature?: string }) => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState(parsed);
  const [phone, setPhone] = useState("");
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const balance = useMemo(() => Math.max(0, (v.total || 0) - (v.paid || 0)), [v.total, v.paid]);
  const phoneOk = phone.trim() === "" || isValidPkPhone(phone);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("reviewOrder")}
          </DialogTitle>
          <DialogDescription>{t("aiHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t("customerName")}>
            <Input value={v.customerName} onChange={(e) => setV({ ...v, customerName: e.target.value })} />
          </Field>
          <Field label={t("items")}>
            <Input value={v.items} onChange={(e) => setV({ ...v, items: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("total")}>
              <Input type="number" value={v.total} onChange={(e) => setV({ ...v, total: +e.target.value })} />
            </Field>
            <Field label={t("paid")}>
              <Input type="number" value={v.paid} onChange={(e) => setV({ ...v, paid: +e.target.value })} />
            </Field>
          </div>
          <Field label={t("dueDate")}>
            <Input type="date" value={v.dueDate || ""} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
          </Field>
          <Field label={t("phone")}>
            <Input
              inputMode="tel"
              placeholder={t("phoneHint")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {!phoneOk && <p className="text-xs text-danger">{t("invalidPhone")}</p>}
          </Field>
          <SignaturePad
            value={signature}
            onChange={setSignature}
            label={`${t("signature")} — ${t("signHere")}`}
            clearLabel={t("clear")}
          />
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">{t("balance")}</span>
            <span className={`text-lg font-black tabular-nums ${balance > 0 ? "text-danger" : "text-success"}`}>
              ₨ {balance.toLocaleString()}
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={() =>
              onSave(
                { ...v, balance },
                { phone: normalizePkPhone(phone) || undefined, signature },
              )
            }
            disabled={!v.customerName.trim() || !phoneOk}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
