"use client";

import { ArrowRight, Briefcase, Building2, FileUp, HardDrive, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ActivityText } from "@/components/activity-text";
import { Badge, Card, Meter, PageHeader, STATUS_TONE } from "@/components/ui";
import { UploadsChart } from "@/components/uploads-chart";
import { storageUsed } from "@/lib/api";
import { formatBytes, formatDate, formatMoney, timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import { kpis, projectsByStatus, storageByCompany, uploadsByDay } from "@/lib/stats";
import type { DemoState, User } from "@/lib/types";

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function RecentActivity({ state, companyId }: { state: DemoState; companyId?: string }) {
  const items = state.activity.filter((a) => !companyId || a.companyId === companyId).slice(0, 6);
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <ActivityText state={state} activity={a} />
          <time dateTime={a.at} className="shrink-0 text-xs text-muted">
            {timeAgo(a.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function AdminDashboard({ state }: { state: DemoState }) {
  const k = useMemo(() => kpis(state), [state]);
  const uploads = useMemo(() => uploadsByDay(state, 30), [state]);
  const storage = useMemo(() => storageByCompany(state), [state]);
  const statuses = projectsByStatus(state);
  const maxStatus = Math.max(1, ...statuses.map((s) => s.count));

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of all clients, projects and file activity." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Building2} label="Active clients" value={String(k.activeClients)} sub={`of ${state.companies.length} total`} />
        <Kpi icon={Users} label="Active users" value={String(k.activeUsers)} sub={`${state.users.filter((u) => u.status === "invited").length} pending invites`} />
        <Kpi icon={Briefcase} label="Open projects" value={String(k.openProjects)} sub={`${formatMoney(k.pipelineValue)} in budget`} />
        <Kpi icon={FileUp} label="Uploads, 30 days" value={String(k.filesLast30)} sub={`${formatBytes(k.storageUsed)} stored`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium">Uploads per day</h2>
            <span className="text-xs text-muted">Last 30 days</span>
          </div>
          <div className="p-4">
            <UploadsChart data={uploads} />
          </div>
        </Card>
        <Card>
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium">Projects by status</h2>
          </div>
          <ul className="space-y-3 p-4">
            {statuses.map((s) => (
              <li key={s.status} className="grid grid-cols-[90px_1fr_24px] items-center gap-3 text-sm">
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium">Storage by client</h2>
            <Link href="/clients" className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              All clients <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          <ul className="space-y-4 p-4">
            {storage.map((c) => (
              <li key={c.id}>
                <div className="mb-1.5 flex justify-between gap-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {formatBytes(c.used)} / {formatBytes(c.quota)}
                  </span>
                </div>
                <Meter value={c.used} max={c.quota} label={`${c.name} storage used`} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-medium">Recent activity</h2>
            <Link href="/activity" className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              Full log <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          <RecentActivity state={state} />
        </Card>
      </div>
    </>
  );
}

function ClientDashboard({ state, user }: { state: DemoState; user: User }) {
  const company = state.companies.find((c) => c.id === user.companyId)!;
  const projects = state.projects.filter((p) => p.companyId === company.id);
  const files = state.files.filter((f) => f.companyId === company.id);
  const used = storageUsed(state, company.id);

  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description={`${company.name} · ${company.plan} plan`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Briefcase} label="Projects" value={String(projects.length)} sub={`${projects.filter((p) => p.status !== "completed").length} in progress`} />
        <Kpi icon={FileUp} label="Files" value={String(files.length)} sub={`${state.folders.filter((f) => f.companyId === company.id).length} folders`} />
        <Kpi icon={HardDrive} label="Storage used" value={formatBytes(used)} sub={`of ${formatBytes(company.quota)}`} />
        <Kpi icon={Users} label="Team members" value={String(state.users.filter((u) => u.companyId === company.id && u.status !== "disabled").length)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium">Your projects</h2>
          </div>
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{p.name}</p>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Meter value={p.progress} max={100} label={`${p.name} progress`} warn={false} />
                  <span className="w-10 text-right text-sm tabular-nums">{p.progress}%</span>
                </div>
                <p className="mt-2 text-xs text-muted">Due {formatDate(p.dueDate)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="font-medium">Storage</h2>
            <p className="mt-1 text-sm text-muted">
              {formatBytes(used)} of {formatBytes(company.quota)} used
            </p>
            <Meter value={used} max={company.quota} label="Storage used" className="mt-3" />
            <Link href="/files" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
              Open file portal <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Card>
          <Card>
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-medium">Recent activity</h2>
            </div>
            <RecentActivity state={state} companyId={company.id} />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { state, user } = useStore();
  if (!state || !user) return null;
  return user.role === "admin" ? <AdminDashboard state={state} /> : <ClientDashboard state={state} user={user} />;
}
