"use client";

import { Building2, FolderOpen, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Card, EmptyState, Field, Meter, Modal, PageHeader, STATUS_TONE, inputClass } from "@/components/ui";
import { storageUsed, updateCompany } from "@/lib/api";
import { formatBytes, formatDate, formatMoney } from "@/lib/format";
import { PLAN_QUOTA } from "@/lib/seed";
import { mutate, useStore } from "@/lib/store";
import type { Company } from "@/lib/types";

export default function ClientsPage() {
  const { state, user } = useStore();
  const { run } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  if (!state || !user) return null;

  const open = state.companies.find((c) => c.id === openId);
  const list = state.companies.filter((c) => `${c.name} ${c.industry} ${c.country}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <PageHeader title="Clients" description="Client companies, their plans and storage." />
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" aria-label="Search clients" className={`${inputClass} mb-4 sm:max-w-xs`} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="No clients match" text="Try another name, industry or country." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const used = storageUsed(state, c.id);
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col p-0 transition-colors duration-100 hover:border-border-strong">
                  <button onClick={() => setOpenId(c.id)} className="flex flex-1 flex-col rounded-lg p-4 text-left" aria-label={`Open ${c.name}`}>
                    <div className="flex w-full items-start gap-3">
                      <Avatar name={c.name} size={32} square />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <MapPin className="size-3" aria-hidden /> {c.country} · {c.industry}
                        </p>
                      </div>
                      <span className="shrink-0">
                        <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                      </span>
                    </div>
                    <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Users</dt>
                        <dd className="font-medium tabular-nums">{state.users.filter((u) => u.companyId === c.id).length}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Projects</dt>
                        <dd className="font-medium tabular-nums">{state.projects.filter((p) => p.companyId === c.id).length}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Plan</dt>
                        <dd className="font-medium">{c.plan}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 w-full">
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Storage</span>
                        <span className="tabular-nums">
                          {formatBytes(used)} / {formatBytes(c.quota)}
                        </span>
                      </div>
                      <Meter value={used} max={c.quota} label={`${c.name} storage used`} />
                    </div>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ""}>
        {open && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Industry</dt>
                <dd>{open.industry}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Country</dt>
                <dd>{open.country}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Client since</dt>
                <dd>{formatDate(open.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Project budget</dt>
                <dd>{formatMoney(state.projects.filter((p) => p.companyId === open.id).reduce((s, p) => s + p.budget, 0))}</dd>
              </div>
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                {(id) => (
                  <select id={id} className={inputClass} value={open.status} onChange={(e) => run(() => mutate((s) => updateCompany(s, user, open.id, { status: e.target.value as Company["status"] })), "Client status updated.")}>
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="paused">Paused</option>
                  </select>
                )}
              </Field>
              <Field label="Plan" hint="Changes the storage quota.">
                {(id, d) => (
                  <select
                    id={id}
                    aria-describedby={d}
                    className={inputClass}
                    value={open.plan}
                    onChange={(e) => {
                      const plan = e.target.value as Company["plan"];
                      run(() => mutate((s) => updateCompany(s, user, open.id, { plan, quota: PLAN_QUOTA[plan] })), `Plan changed to ${plan}.`);
                    }}
                  >
                    {(Object.keys(PLAN_QUOTA) as Company["plan"][]).map((p) => (
                      <option key={p} value={p}>
                        {p} ({formatBytes(PLAN_QUOTA[p])})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">People</h3>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {state.users
                  .filter((u) => u.companyId === open.id)
                  .map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate">
                        {u.name} <span className="text-muted">· {u.title}</span>
                      </span>
                      <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <Link href={`/files?client=${open.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                <FolderOpen className="size-4" /> Open files
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
