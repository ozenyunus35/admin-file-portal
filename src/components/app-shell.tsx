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

export const LogoMark = ({ size = 22 }: { size?: number }) => (
  <span className="grid shrink-0 place-items-center rounded-md bg-text text-bg" style={{ width: size, height: size }} aria-hidden>
    <svg viewBox="0 0 24 24" style={{ width: size * 0.62, height: size * 0.62 }} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 12 4l8 16" />
      <path d="M7.5 13h9" />
    </svg>
  </span>
);

export const Logo = () => (
  <span className="flex items-center gap-2">
    <LogoMark />
    <span className="text-[13px] font-semibold">Atlas Portal</span>
  </span>
);

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const noop = () => () => {};

function Sidebar({ user, path, onNavigate, onSearch, mac }: { user: User; path: string; onNavigate?: () => void; onSearch: () => void; mac: boolean }) {
  const items = NAV.filter((n) => !n.admin || user.role === "admin");
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <>
      <div className="px-2 pb-2">
        <button onClick={onSearch} className="flex h-7 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-muted shadow-card transition-colors hover:text-text">
          <Search className="size-3.5" aria-hidden />
          Search
          <kbd className="ml-auto font-sans text-[11px] text-faint">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
        {groups.map((g) => (
          <div key={g}>
            <p className="px-2 pb-1 text-[11px] font-medium text-faint">{g}</p>
            <div className="space-y-px">
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
                      className={cx("flex h-7 items-center gap-2.5 rounded-md px-2 font-medium transition-colors duration-100", active ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text")}
                    >
                      <n.icon className={cx("size-4", active ? "text-text" : "text-faint")} aria-hidden />
                      {n.label}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

function StorageNote({ state, user }: { state: DemoState; user: User }) {
  const company = state.companies.find((c) => c.id === user.companyId);
  const used = company ? storageUsed(state, company.id) : state.files.reduce((s, f) => s + f.size, 0);
  const quota = company ? company.quota : state.companies.reduce((s, c) => s + c.quota, 0);
  return (
    <div className="px-4 pb-3">
      <div className="flex justify-between text-xs text-muted">
        <span>Storage</span>
        <span className="tabular-nums">
          {formatBytes(used)} / {formatBytes(quota)}
        </span>
      </div>
      <Meter value={used} max={quota} label="Sidebar storage used" className="mt-1.5" />
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
  const items = state.activity.filter((a) => a.actorId !== user.id && (user.role === "admin" || a.companyId === user.companyId)).slice(0, 8);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="relative rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Notifications">
        <Bell className="size-4" />
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] animate-pop overflow-hidden rounded-lg bg-surface shadow-pop">
          <p className="border-b border-border px-3 py-2.5 text-xs font-medium">Notifications</p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((a) => (
              <li key={a.id} className="flex gap-2.5 px-3 py-2">
                <Avatar name={state.users.find((u) => u.id === a.actorId)?.name ?? "?"} size={22} />
                <div className="min-w-0 flex-1">
                  <ActivityText state={state} activity={a} />
                </div>
                <time dateTime={a.at} className="shrink-0 text-xs text-faint">
                  {timeAgo(a.at)}
                </time>
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

  if (!ready || !user || !state) return <Spinner />;

  const navItem = NAV.find((n) => path === n.href || path.startsWith(n.href + "/"));
  const forbidden = navItem?.admin && user.role !== "admin";
  const company = state.companies.find((c) => c.id === user.companyId);
  const openPalette = () => {
    setMenuOpen(false);
    setPaletteOpen(true);
  };

  const signOut = () => {
    setSession(null);
    router.replace("/");
  };

  const workspace = (
    <div className="flex h-12 items-center gap-2 px-4">
      <LogoMark />
      <p className="truncate text-[13px] font-semibold">{company ? company.name : "Atlas Portal"}</p>
    </div>
  );

  const userCard = (
    <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
      <Avatar name={user.name} size={26} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.role === "admin" ? `Admin · ${user.title}` : user.title}</p>
      </div>
      <button onClick={signOut} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out">
        <LogOut className="size-3.5" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-bg lg:flex">
        {workspace}
        <Sidebar user={user} path={path} onSearch={openPalette} mac={mac} />
        <StorageNote state={state} user={user} />
        {userCard}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85%] animate-drawer flex-col border-r border-border bg-bg">
            <div className="flex items-center justify-between pr-2">
              {workspace}
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <Sidebar user={user} path={path} onNavigate={() => setMenuOpen(false)} onSearch={openPalette} mac={mac} />
            <StorageNote state={state} user={user} />
            {userCard}
          </div>
        </div>
      )}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur sm:px-5">
          <button onClick={() => setMenuOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 lg:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-muted">
            <span className="hidden truncate sm:inline">{company ? company.name : "Atlas"}</span>
            <ChevronRight className="hidden size-3.5 text-faint sm:block" aria-hidden />
            <span className="truncate font-medium text-text">{navItem?.label ?? "Overview"}</span>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 hidden items-center gap-2 text-xs text-muted md:flex">
              Demo · synthetic data
              <button onClick={() => setConfirmReset(true)} className="rounded-md border border-border px-2 py-0.5 text-text hover:bg-surface-2">
                Reset demo data
              </button>
            </span>
            <button onClick={() => setConfirmReset(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text md:hidden" aria-label="Reset demo data">
              <RotateCcw className="size-4" />
            </button>
            <button onClick={openPalette} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text lg:hidden" aria-label="Search">
              <Search className="size-4" />
            </button>
            <Notifications state={state} user={user} />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {forbidden ? <EmptyState icon={ShieldAlert} title="You don't have access to this page" text="This section is for admins. Client accounts only see their own projects and files." action={<Link href="/dashboard" className="font-medium text-accent hover:underline">Back to dashboard</Link>} /> : children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} state={state} user={user} onReset={() => setConfirmReset(true)} />

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
              <RotateCcw /> Reset
            </Button>
          </>
        }
      >
        <p className="text-muted">Uploads, edits and share links you made are removed and the original synthetic data is restored.</p>
      </Modal>
    </div>
  );
}
