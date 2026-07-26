import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, LogOut, Trash2 } from "lucide-react";
import { ledgerToCsv, downloadCsv } from "@/lib/export";
import { getShopName, setShopName } from "@/lib/shop";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — VoiceLedger" },
      { name: "description", content: "Update your email, change your password, or delete your account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, customers, updateEmail, updatePassword, deleteAccount, signOut } = useStore();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [shop, setShop] = useState("");

  useEffect(() => {
    setShop(getShopName(""));
  }, []);

  useEffect(() => {
    if (!user) router.navigate({ to: "/auth" });
    else setEmail(user.email ?? "");
  }, [user, router]);
  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <TopNav />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-black">{t("settings")}</h1>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">{t("shopName")}</h2>
          <p className="text-xs text-muted-foreground">{t("shopNameHint")}</p>
          <Input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Saddam General Store" />
          <Button
            onClick={() => {
              setShopName(shop.trim() || "VoiceLedger");
              toast.success(t("shopNameSaved"));
            }}
          >
            {t("saveShopName")}
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">{t("exportLedger")}</h2>
          <p className="text-xs text-muted-foreground">{t("exportHint")}</p>
          <Button
            variant="outline"
            disabled={customers.length === 0}
            onClick={() => {
              downloadCsv(
                `voiceledger-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                ledgerToCsv(customers),
              );
              toast.success(t("exported"));
            }}
          >
            <Download className="me-2 h-4 w-4" />
            {t("exportLedger")}
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">{t("updateEmail")}</h2>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button
            onClick={async () => {
              const r = await updateEmail(email);
              if (!r.ok) toast.error(r.error || "Failed");
              else toast.success(t("emailUpdated"));
            }}
          >
            {t("save")}
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">{t("changePassword")}</h2>
          <div className="space-y-1.5">
            <Label>{t("currentPassword")}</Label>
            <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("newPassword")}</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <Button
            onClick={async () => {
              const r = await updatePassword(cur, next);
              if (!r.ok) toast.error(r.error || "Failed");
              else {
                toast.success(t("passwordChanged"));
                setCur("");
                setNext("");
              }
            }}
            disabled={!cur || !next}
          >
            {t("save")}
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              signOut();
              router.navigate({ to: "/auth" });
            }}
          >
            <LogOut className="me-2 h-4 w-4" />
            {t("signOut")}
          </Button>
        </Card>

        <Card className="border-danger/40 p-5 space-y-3">
          <h2 className="text-lg font-bold text-danger">{t("dangerZone")}</h2>
          <p className="text-sm text-muted-foreground">{t("deleteAccountWarn")}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="me-2 h-4 w-4" />
                {t("deleteAccount")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteAccount")}?</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteAccountWarn")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    const r = await deleteAccount();
                    if (!r.ok) return toast.error(r.error || "Failed");
                    toast.success(t("accountDeleted"));
                    router.navigate({ to: "/auth" });
                  }}
                >
                  {t("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </main>
    </div>
  );
}
