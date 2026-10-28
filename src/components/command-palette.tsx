"use client";

import { Building2, CornerDownLeft, FileText, FolderKanban, Moon, RotateCcw, Search, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoState, User } from "@/lib/types";
import { NAV } from "./nav";
import { cx } from "./ui";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

/** ⌘K / Ctrl+K search across pages, clients, projects, people and files the current user can see. */
export function CommandPalette({ open, onClose, state, user, onReset }: { open: boolean; onClose: () => void; state: DemoState; user: User; onReset: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ("");
      setActive(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const admin = user.role === "admin";
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const mine = <T extends { companyId: string | null }>(list: T[]) => (admin ? list : list.filter((x) => x.companyId === user.companyId));
    const company = (id: string | null) => state.companies.find((c) => c.id === id)?.name ?? "Atlas team";
    return [
      ...NAV.filter((n) => admin || !n.admin).map((n) => ({ id: n.href, group: "Pages", label: n.label, icon: n.icon, run: go(n.href) })),
      ...(admin ? state.companies.map((c) => ({ id: c.id, group: "Clients", label: c.name, hint: `${c.industry} · ${c.plan}`, icon: Building2, run: go("/clients") })) : []),
      ...mine(state.projects).map((p) => ({ id: p.id, group: "Projects", label: p.name, hint: company(p.companyId), icon: FolderKanban, run: go("/projects") })),
      ...(admin ? state.users.map((u) => ({ id: u.id, group: "People", label: u.name, hint: u.email, icon: UserIcon, run: go("/users") })) : []),
      ...mine(state.files).map((f) => ({ id: f.id, group: "Files", label: f.name, hint: company(f.companyId), icon: FileText, run: go("/files") })),
      {
        id: "theme",
        group: "Actions",
        label: "Toggle light / dark theme",
        icon: Moon,
        run: () => {
          const next = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", next);
          try {
            localStorage.setItem("atlas:theme", next ? "dark" : "light");
          } catch {}
          onClose();
        },
      },
      { id: "reset", group: "Actions", label: "Reset demo data", icon: RotateCcw, run: () => (onClose(), onReset()) },
    ];
  }, [state, user, router, onClose, onReset]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hits = needle ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(needle)) : items.filter((i) => i.group === "Pages" || i.group === "Actions");
    return hits.slice(0, 40);
  }, [items, q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-border-strong bg-surface p-0 text-text shadow-2xl shadow-black/50"
    >
      {open && (
        <div onKeyDown={onKey}>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-5 text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search pages, clients, projects, people, files…"
              aria-label="Search everything"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={results[active] ? `cmdk-${results[active].id}` : undefined}
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
            />
            <kbd className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
          </div>
          <ul id="cmdk-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted">No results for “{q}”</li>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <li key={`${r.group}-${r.id}`} role="presentation">
                  {header && <p className="px-3 pt-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{r.group}</p>}
                  <div
                    id={`cmdk-${r.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={r.run}
                    className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm", i === active ? "bg-accent-soft text-text" : "text-text")}
                  >
                    <r.icon className={cx("size-4 shrink-0", i === active ? "text-accent" : "text-muted")} />
                    <span className="truncate font-medium">{r.label}</span>
                    {r.hint && <span className="truncate text-xs text-muted">{r.hint}</span>}
                    {i === active && <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span className="ml-auto">{items.length} items indexed</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
