"use client";

import { Bell, ChevronRight, LogOut, Menu, RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { storageUsed } from "@/lib/api";
import { formatBytes, timeAgo } from "@/lib/format";
import { resetDemo, setSession, useStore } from "@/lib/store";
import type { DemoState, User } from "@/lib/types";
import { ActivityText } from "./activity-text";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { useToast } from "./toast";
import { Avatar, Button, EmptyState, Meter, Modal, Spinner, cx } from "./ui";

export const Logo = ({ sub }: { sub?: string }) => (
  <span className="flex items-center gap-2.5">
    <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#5eead4] to-[#818cf8] text-[#042f2e] shadow-[0_6px_20px_-6px_rgb(94_234_212/0.6)]" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20 12 4l8 16" />
        <path d="M7.5 13h9" />
      </svg>
    </span>
    <span className="leading-none">
      <span className="block font-display text-[15px] font-semibold tracking-tight">Atlas Portal</span>
      {sub && <span className="mt-1 block font-mono text-[10px] tracking-wider text-muted uppercase">{sub}</span>}
    </span>
  </span>
);

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const noop = () => () => {};

function Sidebar({ user, path, onNavigate }: { user: User; path: string; onNavigate?: () => void }) {
  const items = NAV.filter((n) => !n.admin || user.role === "admin");
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.16em] text-muted/80 uppercase">{g}</p>
          <div className="space-y-0.5">
            {items
              .filter((n) => n.group === g)
              .map((n) => {
                const active = path === n.href || path.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-gradient-to-r from-accent-soft to-transparent text-text" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    <span className={cx("absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent transition-all duration-300", active ? "opacity-100" : "scale-y-0 opacity-0")} aria-hidden />
                    <n.icon className={cx("size-[18px] transition-colors", active ? "text-accent" : "group-hover:text-text")} aria-hidden />
                    {n.label}
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function StorageWidget({ state, user }: { state: DemoState; user: User }) {
  const company = state.companies.find((c) => c.id === user.companyId);
  const used = company ? storageUsed(state, company.id) : state.files.reduce((s, f) => s + f.size, 0);
  const quota = company ? company.quota : state.companies.reduce((s, c) => s + c.quota, 0);
  return (
    <div className="mx-3 mb-3 rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{company ? "Your storage" : "Total storage"}</span>
        <span className="font-mono text-muted">{Math.round((used / quota) * 100)}%</span>
      </div>
      <Meter value={used} max={quota} label="Sidebar storage used" className="mt-2 h-1.5" />
      <p className="mt-2 text-[11px] text-muted">
        {formatBytes(used)} of {formatBytes(quota)}
      </p>
    </div>
  );
}

function Notifications({ state, user }: { state: DemoState; user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const items = state.activity.filter((a) => a.actorId !== user.id && (user.role === "admin" || a.companyId === user.companyId)).slice(0, 6);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Notifications">
        <Bell className="size-5" />
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-pop overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-sm font-semibold">Notifications</p>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">{items.length} new</span>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                <Avatar name={state.users.find((u) => u.id === a.actorId)?.name ?? "?"} size={28} />
                <div className="min-w-0">
                  <ActivityText state={state} activity={a} />
                  <time dateTime={a.at} className="text-xs text-muted">
                    {timeAgo(a.at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, user, ready } = useStore();
  const router = useRouter();
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const mac = useSyncExternalStore(noop, isMac, () => true);
  const { toast } = useToast();

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePalette = () => setPaletteOpen(false);
  const askReset = () => setConfirmReset(true);

  if (!ready || !user || !state) return <Spinner />;

  const navItem = NAV.find((n) => path === n.href || path.startsWith(n.href + "/"));
  const forbidden = navItem?.admin && user.role !== "admin";
  const company = state.companies.find((c) => c.id === user.companyId);

  const signOut = () => {
    setSession(null);
    router.replace("/");
  };

  const userCard = (
    <div className="flex items-center gap-3 border-t border-border p-3">
      <Avatar name={user.name} size={36} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.role === "admin" ? "Admin" : "Client"} · {company ? company.name : user.title}</p>
      </div>
      <button onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out">
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo sub={user.role === "admin" ? "Admin workspace" : "Client portal"} />
        </div>
        <Sidebar user={user} path={path} />
        <StorageWidget state={state} user={user} />
        {userCard}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 animate-[enter_0.2s_ease-out_both] bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-drawer flex-col border-r border-border bg-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <Sidebar user={user} path={path} onNavigate={() => setMenuOpen(false)} />
            <StorageWidget state={state} user={user} />
            {userCard}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/75 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm text-muted lg:flex">
            <span>{company ? company.name : "Atlas"}</span>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="font-medium text-text">{navItem?.label ?? "Overview"}</span>
          </nav>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden h-9 w-64 items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 text-sm text-muted shadow-[var(--highlight)] transition-colors hover:border-border-strong hover:text-text md:flex"
          >
            <Search className="size-4" aria-hidden />
            Search…
            <kbd className="ml-auto rounded border border-border px-1.5 font-mono text-[10px]">{mac ? "⌘" : "Ctrl"} K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <button onClick={() => setPaletteOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text md:hidden" aria-label="Search">
              <Search className="size-5" />
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-accent/30 bg-accent-soft py-1 pr-1 pl-3 text-xs xl:flex">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative size-1.5 rounded-full bg-accent" />
              </span>
              <span className="text-text">Live demo · synthetic data</span>
              <button onClick={askReset} className="rounded-full bg-surface px-2 py-0.5 font-medium text-text hover:bg-surface-2">
                Reset demo data
              </button>
            </div>
            <button onClick={askReset} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text xl:hidden" aria-label="Reset demo data">
              <RotateCcw className="size-5" />
            </button>
            <Notifications state={state} user={user} />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {forbidden ? <EmptyState icon={ShieldAlert} title="You don't have access to this page" text="This section is for admins. Client accounts only see their own projects and files." action={<Link href="/dashboard" className="text-sm font-medium text-accent underline">Back to dashboard</Link>} /> : children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} state={state} user={user} onReset={askReset} />

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
