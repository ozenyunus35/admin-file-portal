"use client";

import { Download, FolderKanban } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, Field, Meter, Modal, PageHeader, STATUS_TONE, inputClass } from "@/components/ui";
import { log, updateProject } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatMoney } from "@/lib/format";
import { PROJECT_STATUS_ORDER } from "@/lib/stats";
import { mutate, useStore } from "@/lib/store";
import type { Project, ProjectStatus } from "@/lib/types";

export default function ProjectsPage() {
  const { state, user } = useStore();
  const { toast, run } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: ProjectStatus; progress: number; ownerId: string } | null>(null);
  if (!state || !user) return null;

  const isAdmin = user.role === "admin";
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const rows = state.projects
    .filter((p) => isAdmin || p.companyId === user.companyId)
    .map((p) => ({ ...p, company: state.companies.find((c) => c.id === p.companyId)?.name ?? "", owner: name(p.ownerId) }));
  type Row = (typeof rows)[number];
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
    { key: "status", header: "Status", sortable: true, sortValue: (p) => PROJECT_STATUS_ORDER.indexOf(p.status), render: (p) => <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge> },
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
      <PageHeader title="Projects" description={isAdmin ? "All client projects. Click a row to update it." : "Projects for your company."} />
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
