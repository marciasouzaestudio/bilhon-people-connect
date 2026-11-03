import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  ShieldAlert,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/use-role";
import { ArkomLogo } from "@/components/ArkomLogo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState } from "react";

type NavItem = { to: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "criar",
    label: "Criar",
    items: [
      { to: "/studio", label: "Criador" },
      { to: "/criativos", label: "Criativos" },
      { to: "/lab", label: "Bancada" },
      { to: "/gallery", label: "Galeria" },
    ],
  },
  {
    id: "publicar",
    label: "Publicar",
    items: [
      { to: "/schedule", label: "Agenda" },
      { to: "/accounts", label: "Contas" },
      { to: "/brands", label: "Marcas" },
    ],
  },
  {
    id: "analisar",
    label: "Analisar",
    items: [
      { to: "/analytics", label: "Métricas" },
      { to: "/sources", label: "Biblioteca" },
    ],
  },
  {
    id: "automatizar",
    label: "Automatizar",
    items: [{ to: "/autopilot", label: "Emily" }],
  },
];

function useHasAnySavedConfig() {
  const { config } = useApp();
  return !!(
    config.onboardingCompleted ||
    config.postformeApiKey ||
    config.apifyApiToken ||
    config.firecrawlApiKey
  );
}

function GroupDropdown({ group, activePath }: { group: NavGroup; activePath: string }) {
  const isActive = group.items.some((i) => i.to === activePath);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {group.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {group.items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <NavLink
              to={item.to}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm",
                activePath === item.to && "bg-primary/10 text-primary font-medium"
              )}
            >
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const hasAnySavedConfig = useHasAnySavedConfig();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 rounded-full">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white">
            <UserIcon className="h-3.5 w-3.5" />
          </span>
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:inline">
            {user?.email || "Conta"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {user?.email && (
          <>
            <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <NavLink to={hasAnySavedConfig ? "/setup?manage=1" : "/setup"} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" /> Configurações
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { await signOut(); }} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  return (
    <NavLink to="/dashboard" className="flex items-center" aria-label="Arkom Social Hub">
      <ArkomLogo size={36} />
    </NavLink>
  );
}

function DesktopTopBar() {
  const { pathname } = useLocation();
  const { isAdmin } = useRole();

  const dashActive = pathname === "/dashboard";
  const adminActive = pathname === "/admin";

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <Brand />

      <nav className="ml-4 flex items-center gap-1">
        <NavLink
          to="/dashboard"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            dashActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>
        {GROUPS.map((g) => (
          <GroupDropdown key={g.id} group={g} activePath={pathname} />
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              adminActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <ShieldAlert className="h-4 w-4" />
            Administração
          </NavLink>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <AccountMenu />
      </div>
    </header>
  );
}

function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAdmin } = useRole();
  const { user, signOut } = useAuth();
  const hasAnySavedConfig = useHasAnySavedConfig();

  const closeAnd = (fn?: () => void) => () => { setOpen(false); fn?.(); };

  const linkCls = (to: string) =>
    cn(
      "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      pathname === to ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-full flex-col">
            <div className="px-4 py-4">
              <Brand />
            </div>
            <Separator />
            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              <NavLink to="/dashboard" onClick={closeAnd()} className={linkCls("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </NavLink>
              {GROUPS.map((g) => (
                <div key={g.id} className="space-y-1">
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </p>
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} onClick={closeAnd()} className={linkCls(it.to)}>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              ))}
              {isAdmin && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sistema
                  </p>
                  <NavLink to="/admin" onClick={closeAnd()} className={linkCls("/admin")}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Administração
                  </NavLink>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-1 p-3">
              <NavLink
                to={hasAnySavedConfig ? "/setup?manage=1" : "/setup"}
                onClick={closeAnd()}
                className={linkCls("/setup")}
              >
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </NavLink>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                onClick={closeAnd(async () => { await signOut(); })}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
              {user?.email && (
                <p className="px-3 pt-1 text-[10px] text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Brand />
      </div>

      <AccountMenu />
    </header>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileTopBar /> : <DesktopTopBar />;
}
