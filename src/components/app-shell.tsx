"use client";

import { Activity, Building2, FolderKanban, FolderOpen, LayoutDashboard, LogOut, Menu, RotateCcw, Settings, ShieldAlert, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { resetDemo, setSession, useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";
import { useToast } from "./toast";
import { Avatar, Button, EmptyState, Modal, Spinner, cx } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: false },
  { href: "/clients", label: "Clients", icon: Building2, admin: true },
  { href: "/projects", label: "Projects", icon: FolderKanban, admin: false },
  { href: "/users", label: "Users", icon: Users, admin: true },
  { href: "/files", label: "Files", icon: FolderOpen, admin: false },
  { href: "/activity", label: "Activity log", icon: Activity, admin: true },
  { href: "/settings", label: "Settings", icon: Settings, admin: false },
];

export const Logo = () => (
  <span className="flex items-center gap-2 font-semibold tracking-tight">
    <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20 12 4l8 16" />
        <path d="M7.5 13h9" />
      </svg>
    </span>
    Atlas Portal
  </span>
);

function Sidebar({ user, path, onNavigate }: { user: User; path: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
      {NAV.filter((n) => !n.admin || user.role === "admin").map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}
          >
            <n.icon className="size-4.5" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, user, ready } = useStore();
  const router = useRouter();
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  if (!ready || !user || !state) return <Spinner />;

  const navItem = NAV.find((n) => path === n.href || path.startsWith(n.href + "/"));
  const forbidden = navItem?.admin && user.role !== "admin";
  const company = state.companies.find((c) => c.id === user.companyId);

  const signOut = () => {
    setSession(null);
    router.replace("/");
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo />
        </div>
        <Sidebar user={user} path={path} />
        <div className="border-t border-border p-3 text-xs text-muted">Signed in as {user.role === "admin" ? "Admin" : "Client"}</div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Logo />
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <Sidebar user={user} path={path} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-fg">
          Demo with a mock backend: all data is synthetic and stays in this browser.{" "}
          <button onClick={() => setConfirmReset(true)} className="underline underline-offset-2">
            Reset demo data
          </button>
        </div>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
              <Avatar name={user.name} />
              <div className="leading-tight">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted">{company ? company.name : user.title}</p>
              </div>
            </div>
            <button onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out">
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {forbidden ? <EmptyState icon={ShieldAlert} title="You don't have access to this page" text="This section is for admins. Client accounts only see their own projects and files." action={<Link href="/dashboard" className="text-sm font-medium text-accent underline">Back to dashboard</Link>} /> : children}
        </main>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDemo(user.id);
                setConfirmReset(false);
                toast("Demo data was reset.");
              }}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Uploads, edits and share links you made are removed and the original synthetic data is restored.</p>
      </Modal>
    </div>
  );
}
