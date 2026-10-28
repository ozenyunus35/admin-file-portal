"use client";

import { ArrowRight, ArrowUpRight, Briefcase, Building2, CalendarClock, FileUp, HardDrive, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityText } from "@/components/activity-text";
import { AnimatedNumber, Avatar, Badge, Card, CardHeader, Delta, Meter, PageHeader, ProgressRing, STATUS_TONE, Sparkline, cx } from "@/components/ui";
import { STATUS_COLOR, StatusDonut, TrendChart, TrendLegend } from "@/components/uploads-chart";
import { storageUsed } from "@/lib/api";
import { formatBytes, formatMoney, timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import { kpis, periodTotals, projectsByStatus, storageByCompany, trendByDay } from "@/lib/stats";
import type { DemoState, Project, User } from "@/lib/types";

const DAY = 86_400_000;
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const today = () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

function RangeSwitch({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-border bg-surface p-0.5 shadow-[var(--highlight)]">
      {RANGES.map((r) => (
        <button
          key={r}
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cx("rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-all", value === r ? "bg-surface-3 text-text shadow-sm" : "text-muted hover:text-text")}
        >
          {r}D
        </button>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, format, sub, children, tint, i }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; format?: (n: number) => string; sub?: React.ReactNode; children?: React.ReactNode; tint: string; i: number }) {
  return (
    <Card className="stagger group relative overflow-hidden p-4 transition-all sm:p-5 duration-300 hover:-translate-y-0.5 hover:border-border-strong" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
      <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25" style={{ background: tint }} aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className="text-[13px] text-muted sm:text-sm">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="relative mt-3 truncate font-display text-[26px] leading-none font-semibold tracking-tight sm:text-[32px]">
        <AnimatedNumber value={value} format={format} />
      </p>
      <div className="relative mt-2 min-h-5">{sub}</div>
      {children && <div className="relative mt-3">{children}</div>}
    </Card>
  );
}

function ActivityFeed({ state, companyId, limit = 7 }: { state: DemoState; companyId?: string; limit?: number }) {
  const items = state.activity.filter((a) => !companyId || a.companyId === companyId).slice(0, limit);
  return (
    <ol className="relative px-5 pb-4">
      <span className="absolute top-3 bottom-6 left-[34px] w-px bg-gradient-to-b from-border-strong to-transparent" aria-hidden />
      {items.map((a, i) => (
        <li key={a.id} className="stagger relative flex items-start gap-3 py-2.5 text-sm" style={{ "--d": `${200 + i * 50}ms` } as React.CSSProperties}>
          <Avatar name={state.users.find((u) => u.id === a.actorId)?.name ?? "?"} size={28} />
          <div className="min-w-0 flex-1">
            <ActivityText state={state} activity={a} />
            <time dateTime={a.at} className="font-mono text-[11px] text-muted">
              {timeAgo(a.at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DueSoon({ state, projects }: { state: DemoState; projects: Project[] }) {
  const [now] = useState(() => Date.now());
  const list = projects
    .filter((p) => p.status !== "completed")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  return (
    <ul className="space-y-1 px-3 pb-3">
      {list.map((p) => {
        const days = Math.round((Date.parse(p.dueDate) - now) / DAY);
        const late = days < 0;
        return (
          <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
            <ProgressRing value={p.progress} label={`${p.name} progress`} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted">{state.companies.find((c) => c.id === p.companyId)?.name}</p>
            </div>
            <span className={cx("shrink-0 rounded-md px-2 py-1 font-mono text-[11px]", late ? "bg-danger-soft text-danger" : days <= 7 ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted")}>
              {late ? `${-days}d late` : days === 0 ? "today" : `in ${days}d`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBreakdown({ state, companyId }: { state: DemoState; companyId?: string }) {
  const statuses = projectsByStatus(state, companyId);
  const total = Math.max(1, statuses.reduce((s, x) => s + x.count, 0));
  return (
    <div className="flex flex-col items-center gap-5 px-5 pb-5 sm:flex-row lg:flex-col xl:flex-row">
      <StatusDonut data={statuses} />
      <ul className="w-full flex-1 space-y-2.5">
        {statuses.map((s) => (
          <li key={s.status} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[s.status] }} aria-hidden />
            <span className="flex-1 capitalize">{s.status.replace("-", " ")}</span>
            <span className="font-mono text-xs text-muted">{Math.round((s.count / total) * 100)}%</span>
            <span className="w-6 text-right font-medium tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminDashboard({ state, user }: { state: DemoState; user: User }) {
  const [range, setRange] = useState<Range>(30);
  const k = useMemo(() => kpis(state), [state]);
  const trend = useMemo(() => trendByDay(state, 30), [state]);
  const storage = useMemo(() => storageByCompany(state).slice(0, 5), [state]);
  const shown = trend.slice(-range);
  const uploads7 = periodTotals(trend, "uploads", 7);
  const logins7 = periodTotals(trend, "logins", 7);
  const uploadsInRange = shown.reduce((s, p) => s + p.uploads, 0);
  const statuses = projectsByStatus(state);

  return (
    <>
      <PageHeader
        eyebrow={today()}
        title="Dashboard"
        description={`${greeting()}, ${user.name.split(" ")[0]}. Here's what moved across ${state.companies.length} clients.`}
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi i={0} icon={Building2} tint="var(--chart-1)" label="Active clients" value={k.activeClients} sub={<span className="text-xs text-muted">of {state.companies.length} total · {state.companies.filter((c) => c.status === "onboarding").length} onboarding</span>}>
          <div className="flex -space-x-1">
            {state.companies.slice(0, 6).map((c) => (
              <span key={c.id} title={c.name}>
                <Avatar name={c.name} size={26} />
              </span>
            ))}
          </div>
        </Kpi>
        <Kpi i={1} icon={Users} tint="var(--chart-2)" label="Active users" value={k.activeUsers} sub={<Delta current={logins7.current} previous={logins7.previous} label="sign-ins vs last week" />}>
          <Sparkline data={trend.map((p) => p.logins)} color="var(--chart-2)" />
        </Kpi>
        <Kpi i={2} icon={Briefcase} tint="var(--chart-3)" label="Open projects" value={k.openProjects} sub={<span className="text-xs text-muted">{formatMoney(k.pipelineValue)} in budget</span>}>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {statuses
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.status} className="meter-fill h-full" style={{ flex: s.count, background: STATUS_COLOR[s.status] }} />
              ))}
          </div>
        </Kpi>
        <Kpi i={3} icon={FileUp} tint="var(--chart-1)" label={`Uploads, ${range} days`} value={uploadsInRange} sub={<Delta current={uploads7.current} previous={uploads7.previous} label="vs last week" />}>
          <Sparkline data={shown.map((p) => p.uploads)} />
        </Kpi>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="stagger lg:col-span-2" style={{ "--d": "280ms" } as React.CSSProperties}>
          <CardHeader title="Uploads & sign-ins" meta={<TrendLegend />} />
          <div className="px-3 pb-4">
            <TrendChart data={shown} />
          </div>
        </Card>
        <Card className="stagger" style={{ "--d": "340ms" } as React.CSSProperties}>
          <CardHeader title="Projects by status" meta={<Link href="/projects" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">Open <ArrowUpRight className="size-3" aria-hidden /></Link>} />
          <StatusBreakdown state={state} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="stagger" style={{ "--d": "400ms" } as React.CSSProperties}>
          <CardHeader
            title="Storage by client"
            meta={
              <Link href="/clients" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                All clients <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <ul className="space-y-4 px-5 pb-5">
            {storage.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Avatar name={c.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                      {formatBytes(c.used)} / {formatBytes(c.quota)}
                    </span>
                  </div>
                  <Meter value={c.used} max={c.quota} label={`${c.name} storage used`} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="stagger" style={{ "--d": "460ms" } as React.CSSProperties}>
          <CardHeader title="Due soon" icon={CalendarClock} meta={<span className="font-mono">{k.openProjects} open</span>} />
          <DueSoon state={state} projects={state.projects} />
        </Card>
        <Card className="stagger lg:col-span-2 xl:col-span-1" style={{ "--d": "520ms" } as React.CSSProperties}>
          <CardHeader
            title="Recent activity"
            meta={
              <Link href="/activity" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                Full log <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <ActivityFeed state={state} />
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
  const trend = trendByDay(state, 30, undefined, company.id);
  const uploads7 = periodTotals(trend, "uploads", 7);
  const team = state.users.filter((u) => u.companyId === company.id && u.status !== "disabled");

  return (
    <>
      <PageHeader eyebrow={today()} title={`Welcome back, ${user.name.split(" ")[0]}`} description={`${company.name} · ${company.plan} plan`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi i={0} icon={Briefcase} tint="var(--chart-1)" label="Projects" value={projects.length} sub={<span className="text-xs text-muted">{projects.filter((p) => p.status !== "completed").length} in progress</span>} />
        <Kpi i={1} icon={FileUp} tint="var(--chart-2)" label="Files" value={files.length} sub={<Delta current={uploads7.current} previous={uploads7.previous} label="uploads vs last week" />}>
          <Sparkline data={trend.map((p) => p.uploads)} color="var(--chart-2)" />
        </Kpi>
        <Kpi i={2} icon={HardDrive} tint="var(--chart-3)" label="Storage used" value={used} format={formatBytes} sub={<span className="text-xs text-muted">of {formatBytes(company.quota)}</span>}>
          <Meter value={used} max={company.quota} label="Storage used" />
        </Kpi>
        <Kpi i={3} icon={Users} tint="var(--chart-1)" label="Team members" value={team.length}>
          <div className="flex -space-x-1">
            {team.slice(0, 6).map((u) => (
              <span key={u.id} title={u.name}>
                <Avatar name={u.name} size={26} />
              </span>
            ))}
          </div>
        </Kpi>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="stagger lg:col-span-2" style={{ "--d": "280ms" } as React.CSSProperties}>
          <CardHeader title="Your projects" meta={<Link href="/projects" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">All projects <ArrowRight className="size-3" aria-hidden /></Link>} />
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-surface-2/50 p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-1 text-xs text-muted">Due {new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <ProgressRing value={p.progress} label={`${p.name} progress`} size={52} />
                </div>
                <div className="mt-3">
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5">
            <p className="mb-2 text-sm font-medium">Upload activity, 30 days</p>
            <TrendChart data={trend} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="stagger relative overflow-hidden p-5" style={{ "--d": "340ms" } as React.CSSProperties}>
            <div className="absolute -top-20 -right-20 size-48 rounded-full bg-accent/15 blur-3xl" aria-hidden />
            <h2 className="relative font-display text-[15px] font-semibold">Storage</h2>
            <p className="relative mt-1 text-sm text-muted">
              {formatBytes(used)} of {formatBytes(company.quota)} used
            </p>
            <Meter value={used} max={company.quota} label={`${company.name} storage overview`} className="relative mt-3" />
            <Link href="/files" className="relative mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Open file portal <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Card>
          <Card className="stagger" style={{ "--d": "400ms" } as React.CSSProperties}>
            <CardHeader title="Recent activity" />
            <ActivityFeed state={state} companyId={company.id} limit={6} />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { state, user } = useStore();
  if (!state || !user) return null;
  return user.role === "admin" ? <AdminDashboard state={state} user={user} /> : <ClientDashboard state={state} user={user} />;
}
