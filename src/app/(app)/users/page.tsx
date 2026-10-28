"use client";

import { Download, Pencil, UserPlus, UserX, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, STATUS_TONE, inputClass } from "@/components/ui";
import { ApiError, createUser, log, setUserStatus, updateUser, type UserInput } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/format";
import { mutate, useStore } from "@/lib/store";
import type { DemoState, User } from "@/lib/types";

const EMPTY: UserInput = { name: "", email: "", role: "client", title: "", companyId: null };

function UserForm({ state, initial, onSubmit, onCancel, submitLabel }: { state: DemoState; initial: UserInput; onSubmit: (v: UserInput) => string | null; onCancel: () => void; submitLabel: string }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<UserInput>) => {
    setV((x) => ({ ...x, ...patch }));
    setError(null);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(onSubmit(v));
      }}
      className="space-y-4"
    >
      <Field label="Full name">{(id) => <input id={id} className={inputClass} value={v.name} onChange={(e) => set({ name: e.target.value })} required />}</Field>
      <Field label="Email">{(id) => <input id={id} type="email" className={inputClass} value={v.email} onChange={(e) => set({ email: e.target.value })} required />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          {(id) => (
            <select id={id} className={inputClass} value={v.role} onChange={(e) => set({ role: e.target.value as User["role"] })}>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          )}
        </Field>
        <Field label="Job title">{(id) => <input id={id} className={inputClass} value={v.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
      </div>
      {v.role === "client" && (
        <Field label="Company">
          {(id) => (
            <select id={id} className={inputClass} value={v.companyId ?? ""} onChange={(e) => set({ companyId: e.target.value || null })}>
              <option value="">Select a company</option>
              {state.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { state, user: me } = useStore();
  const { toast, run } = useToast();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  if (!state || !me) return null;

  const companyName = (id: string | null) => state.companies.find((c) => c.id === id)?.name ?? "Atlas team";
  const rows = state.users.map((u) => ({ ...u, company: companyName(u.companyId) }));
  type Row = (typeof rows)[number];

  const submit = (v: UserInput) => {
    try {
      if (editing === "new") {
        mutate((s) => createUser(s, me, v));
        toast(`Invitation sent to ${v.email.trim()} (simulated).`);
      } else if (editing) {
        mutate((s) => updateUser(s, me, editing.id, v));
        toast("User updated.");
      }
      setEditing(null);
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : "Something went wrong.";
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{u.name}</p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", sortable: true, render: (u) => <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role}</Badge> },
    { key: "company", header: "Company", sortable: true, hideOnMobile: true, render: (u) => <span className="text-muted">{u.company}</span> },
    { key: "status", header: "Status", sortable: true, render: (u) => <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge> },
    { key: "lastActiveAt", header: "Last active", sortable: true, hideOnMobile: true, sortValue: (u) => (u.lastActiveAt ? -Date.parse(u.lastActiveAt) : null), render: (u) => <span className="text-muted">{timeAgo(u.lastActiveAt)}</span> },
    {
      key: "id",
      header: "Actions",
      className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(u)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={`Edit ${u.name}`}>
            <Pencil className="size-4" />
          </button>
          {u.status === "disabled" ? (
            <button onClick={() => run(() => mutate((s) => setUserStatus(s, me, u.id, "active")), `${u.name} was re-enabled.`)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-success" aria-label={`Enable ${u.name}`}>
              <UserCheck className="size-4" />
            </button>
          ) : (
            <button onClick={() => run(() => mutate((s) => setUserStatus(s, me, u.id, "disabled")), `${u.name} was disabled.`)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger" aria-label={`Disable ${u.name}`}>
              <UserX className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const exportCsv = (visible: Row[]) => {
    const csv = toCsv(visible, [
      { header: "Name", value: (u) => u.name },
      { header: "Email", value: (u) => u.email },
      { header: "Role", value: (u) => u.role },
      { header: "Title", value: (u) => u.title },
      { header: "Company", value: (u) => u.company },
      { header: "Status", value: (u) => u.status },
      { header: "Created", value: (u) => u.createdAt.slice(0, 10) },
      { header: "Last active", value: (u) => u.lastActiveAt?.slice(0, 10) ?? "" },
    ]);
    downloadCsv(csv, `users-${new Date().toISOString().slice(0, 10)}.csv`);
    mutate((s) => log(s, me, "export.csv", `${visible.length} users`, null));
    toast(`Exported ${visible.length} users to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Users"
        description={`${state.users.length} people across ${state.companies.length} clients and the Atlas team.`}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <UserPlus className="size-4" /> Invite user
          </Button>
        }
      />
      <Card>
        <DataTable
          label="Users"
          rows={rows}
          columns={columns}
          rowKey={(u) => u.id}
          searchKeys={["name", "email", "company", "title"]}
          searchPlaceholder="Search name, email or company"
          filters={[
            { key: "role", label: "Role", options: [{ value: "admin", label: "Admin" }, { value: "client", label: "Client" }] },
            { key: "status", label: "Status", options: ["active", "invited", "disabled"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
            { key: "companyId", label: "Company", options: state.companies.map((c) => ({ value: c.id, label: c.name })) },
          ]}
          initialSort={{ key: "name", dir: "asc" }}
          toolbar={(visible) => (
            <Button size="sm" onClick={() => exportCsv(visible)} disabled={visible.length === 0}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
          empty={<EmptyState icon={Users} title="No users match" text="Try a different search or clear the filters." />}
        />
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Invite user" : "Edit user"}>
        {editing && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            state={state}
            initial={editing === "new" ? EMPTY : { name: editing.name, email: editing.email, role: editing.role, title: editing.title, companyId: editing.companyId }}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
            submitLabel={editing === "new" ? "Send invite" : "Save changes"}
          />
        )}
      </Modal>
    </>
  );
}
