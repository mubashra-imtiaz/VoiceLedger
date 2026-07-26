import { Link, useRouter } from "@tanstack/react-router";
import { Moon, Sun, Languages, LogOut, LayoutDashboard, Users, Settings as SettingsIcon, Wallet } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { InstallPwaButton } from "@/components/install-pwa-button";

export function TopNav() {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { signOut, user } = useStore();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="truncate text-lg font-bold">{t("appName")}</span>
        </Link>

        <nav className="ms-2 hidden items-center gap-1 sm:flex">
          <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label={t("dashboard")} />
          <NavLink to="/customers" icon={<Users className="h-4 w-4" />} label={t("customers")} />
          <NavLink to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label={t("settings")} />
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <InstallPwaButton />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            aria-label="Toggle language"
          >
            <Languages className="h-4 w-4" />
            <span className="ms-1 hidden text-xs font-semibold sm:inline">
              {lang === "en" ? "اردو" : "EN"}
            </span>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                signOut();
                router.navigate({ to: "/auth" });
              }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 border-t px-2 py-1 sm:hidden">
        <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label={t("dashboard")} />
        <NavLink to="/customers" icon={<Users className="h-4 w-4" />} label={t("customers")} />
        <NavLink to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label={t("settings")} />
      </nav>
    </header>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex-initial"
      activeProps={{ className: "bg-accent text-accent-foreground" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
