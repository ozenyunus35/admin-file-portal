"use client";

import { CalendarDays, Download, FolderKanban, KanbanSquare, Table2 } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { Avatar, Button, Card, EmptyState, Field, Meter, Modal, PageHeader, ProgressRing, StatusIcon, cx, inputClass } from "@/components/ui";
import { log, updateProject } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatMoney } from "@/lib/format";
import { PROJECT_STATUS_ORDER } from "@/lib/stats";
import { mutate, useStore } from "@/lib/store";
import type { Project, ProjectStatus } from "@/lib/types";

type Row = Project & { company: string; owner: string };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Board({ rows, isAdmin, onOpen }: { rows: Row[]; isAdmin: boolean; onOpen?: (p: Project) => void }) {
  const [now] = useState(() => Date.now());
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1080px] grid-cols-5 gap-3">
        {PROJECT_STATUS_ORDER.map((status) => {
          const list = rows.filter((r) => r.status === status).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          return (
            <section key={status} aria-label={`${status} projects`} className="flex min-w-0 flex-col">
              <header className="flex h-9 items-center gap-2 px-1">
                <StatusIcon status={status} />
                <h2 className="font-medium capitalize">{status.replace("-", " ")}</h2>
                <span className="text-muted tabular-nums">{list.length}</span>
                <span className="ml-auto text-xs text-faint tabular-nums">{formatMoney(list.reduce((s, p) => s + p.budget, 0))}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-1.5 rounded-lg bg-surface-2/60 p-1.5">
                {list.length === 0 && <li className="px-3 py-8 text-center text-xs text-faint">No projects</li>}
                {list.map((p) => {
                  const late = Date.parse(p.dueDate) < now && p.status !== "completed";
                  const body = (
                    <>
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug font-medium">{p.name}</span>
                          {isAdmin && <span className="mt-0.5 block truncate text-xs text-muted">{p.company}</span>}
                        </span>
                        <span title={p.owner}>
                          <Avatar name={p.owner} size={20} />
                        </span>
                      </span>
                      <span className="mt-3 flex items-center gap-2 text-xs text-muted">
                        <ProgressRing value={p.progress} label={`${p.name} progress`} size={14} />
                        <span className="ml-auto inline-flex items-center gap-1 rounded border border-border px-1.5 py-px tabular-nums">
                          <CalendarDays className={cx("size-3", late && "text-danger")} aria-hidden />
                          <span className={late ? "text-danger" : ""}>{shortDate(p.dueDate)}</span>
                        </span>
                      </span>
                    </>
                  );
                  const cls = "block w-full rounded-md border border-border bg-surface p-2.5 text-left shadow-card transition-colors duration-100 hover:border-border-strong";
                  return (
                    <li key={p.id}>
                      {onOpen ? (
                        <button onClick={() => onOpen(p)} className={cls} aria-label={`Update ${p.name}${isAdmin ? `, ${p.company}` : ""}`}>
                          {body}
                        </button>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { state, user } = useStore();
  const { toast, run } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: ProjectStatus; progress: number; ownerId: string } | null>(null);
  const [view, setView] = useState<"board" | "table">("board");
  if (!state || !user) return null;

  const isAdmin = user.role === "admin";
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const rows: Row[] = state.projects
    .filter((p) => isAdmin || p.companyId === user.companyId)
    .map((p) => ({ ...p, company: state.companies.find((c) => c.id === p.companyId)?.name ?? "", owner: name(p.ownerId) }));
  const editing = state.projects.find((p) => p.id === editId);
  const admins = state.users.filter((u) => u.role === "admin" && u.status === "active");

  const startEdit = (p: Project) => {
    setEditId(p.id);
    setDraft({ status: p.status, progress: p.progress, ownerId: p.ownerId });
  };

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Project",
      sortable: true,
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium">{p.name}</p>
          {isAdmin && <p className="text-xs text-muted">{p.company}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", sortable: true, sortValue: (p) => PROJECT_STATUS_ORDER.indexOf(p.status), render: (p) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap capitalize">
          <StatusIcon status={p.status} />
          {p.status.replace("-", " ")}
        </span>
      ) },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      className: "min-w-36",
      render: (p) => (
        <div className="flex items-center gap-2">
          <Meter value={p.progress} max={100} label={`${p.name} progress`} warn={false} />
          <span className="w-9 text-right text-xs tabular-nums">{p.progress}%</span>
        </div>
      ),
    },
    { key: "budget", header: "Budget", sortable: true, hideOnMobile: true, className: "text-right tabular-nums", render: (p) => formatMoney(p.budget) },
    { key: "owner", header: "Owner", sortable: true, hideOnMobile: true, render: (p) => <span className="text-muted">{p.owner}</span> },
    { key: "dueDate", header: "Due", sortable: true, hideOnMobile: true, render: (p) => <span className="whitespace-nowrap text-muted">{formatDate(p.dueDate)}</span> },
  ];

  const exportCsv = (visible: Row[]) => {
    downloadCsv(
      toCsv(visible, [
        { header: "Project", value: (p) => p.name },
        { header: "Client", value: (p) => p.company },
        { header: "Status", value: (p) => p.status },
        { header: "Progress %", value: (p) => p.progress },
        { header: "Budget USD", value: (p) => p.budget },
        { header: "Owner", value: (p) => p.owner },
        { header: "Start", value: (p) => p.startDate.slice(0, 10) },
        { header: "Due", value: (p) => p.dueDate.slice(0, 10) },
      ]),
      `projects-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    mutate((s) => log(s, user, "export.csv", `${visible.length} projects`, isAdmin ? null : user.companyId));
    toast(`Exported ${visible.length} projects to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description={isAdmin ? `${rows.length} client projects, ${formatMoney(rows.filter((p) => p.status !== "completed").reduce((s, p) => s + p.budget, 0))} in open budget. Click one to update it.` : "Projects for your company."}
        actions={
          <div role="group" aria-label="View" className="inline-flex h-8 items-center rounded-md border border-border bg-surface p-0.5 shadow-card">
            {(
              [
                ["board", "Board", KanbanSquare],
                ["table", "Table", Table2],
              ] as const
            ).map(([v, label, Icon]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cx("inline-flex h-full items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors", view === v ? "bg-surface-3 text-text" : "text-muted hover:text-text")}>
                <Icon className="size-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
        }
      />
      {view === "board" ? (
        <Board rows={rows} isAdmin={isAdmin} onOpen={isAdmin ? startEdit : undefined} />
      ) : (
        <Card>
          <DataTable
            label="Projects"
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            searchKeys={["name", "company", "owner"]}
            searchPlaceholder={isAdmin ? "Search project, client or owner" : "Search projects"}
            filters={[
              { key: "status", label: "Status", options: PROJECT_STATUS_ORDER.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
              ...(isAdmin ? [{ key: "companyId" as const, label: "Client", options: state.companies.map((c) => ({ value: c.id, label: c.name })) }] : []),
            ]}
            initialSort={{ key: "dueDate", dir: "asc" }}
            onRowClick={isAdmin ? startEdit : undefined}
            toolbar={(visible) => (
              <Button size="sm" onClick={() => exportCsv(visible)} disabled={visible.length === 0}>
                <Download className="size-4" /> Export CSV
              </Button>
            )}
            empty={<EmptyState icon={FolderKanban} title="No projects match" text="Try a different search or clear the filters." />}
          />
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditId(null)}
        title={editing ? `Update ${editing.name}` : ""}
        footer={
          <>
            <Button onClick={() => setEditId(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!editing || !draft) return;
                run(() => mutate((s) => updateProject(s, user, editing.id, draft)), "Project updated.");
                setEditId(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && draft && (
          <div className="space-y-4">
            <Field label="Status">
              {(id) => (
                <select id={id} className={inputClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus, progress: e.target.value === "completed" ? 100 : draft.progress })}>
                  {PROJECT_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={`Progress: ${draft.progress}%`}>
              {(id) => <input id={id} type="range" min={0} max={100} step={5} value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />}
            </Field>
            <Field label="Owner">
              {(id) => (
                <select id={id} className={inputClass} value={draft.ownerId} onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
