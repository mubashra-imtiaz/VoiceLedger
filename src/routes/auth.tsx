import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wallet, Moon, Sun, Languages } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — VoiceLedger" },
      { name: "description", content: "Sign in to VoiceLedger to manage your customer khaata." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, signIn, signUp, resetPassword } = useStore();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNoAccount, setShowNoAccount] = useState(false);

  useEffect(() => {
    if (user) router.navigate({ to: "/dashboard" });
  }, [user, router]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirm("");
  };

  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "up") {
        if (password !== confirm) return toast.error("Passwords don't match");
        const res = await signUp(email, password);
        if (!res.ok) return toast.error(res.error || "Failed");
        resetForm();
        router.navigate({ to: "/dashboard" });
      } else if (mode === "in") {
        const res = await signIn(email, password);
        if (!res.ok) {
          if (res.error === "no_account") {
            setShowNoAccount(true);
            return;
          }
          return toast.error(res.error || "Failed");
        }
        router.navigate({ to: "/dashboard" });
      } else if (mode === "forgot") {
        const res = await resetPassword(email);
        if (!res.ok) {
          if (res.error === "no_account") {
            setShowNoAccount(true);
            return;
          }
          return toast.error(res.error || "Failed");
        }
        toast.success(t("resetEmailSent"));
        resetForm();
        setMode("in");
      }
    } finally {
      setBusy(false);
    }
  };

  const switchToSignUp = () => {
    setShowNoAccount(false);
    resetForm();
    setMode("up");
  };

  const title = mode === "in" ? t("welcome") : mode === "up" ? t("createAccount") : t("resetPassword");
  const submitLabel = mode === "in" ? t("signIn") : mode === "up" ? t("signUp") : t("resetPassword");

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
      <div className="absolute end-4 top-4 flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setLang(lang === "en" ? "ur" : "en")}>
          <Languages className="h-4 w-4" />
          <span className="ms-1 text-xs font-semibold">{lang === "en" ? "اردو" : "EN"}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t("appName")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-bold">{title}</h2>
          {mode === "forgot" && (
            <p className="mt-1 text-sm text-muted-foreground">{t("resetPasswordHint")}</p>
          )}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="pw">{t("password")}</Label>
                <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="pw2">{t("confirmPassword")}</Label>
                <Input id="pw2" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {submitLabel}
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center">
            {mode === "in" && (
              <button
                onClick={() => { resetForm(); setMode("forgot"); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t("forgotPassword")}
              </button>
            )}
            <button
              onClick={() => {
                resetForm();
                setMode(mode === "in" ? "up" : "in");
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "in" ? t("noAccount") : mode === "up" ? t("haveAccount") : t("backToSignIn")}
            </button>
          </div>
        </Card>
      </div>

      <AlertDialog open={showNoAccount} onOpenChange={setShowNoAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("noAccountTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("noAccountBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowNoAccount(false)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={switchToSignUp}>{t("createAccountNow")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
