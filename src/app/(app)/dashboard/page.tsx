"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityText } from "@/components/activity-text";
import { Avatar, Card, CardHeader, Delta, Meter, PageHeader, ProgressRing, STATUS_COLOR, Sparkline, StatusIcon, cx, STATUS_NAME } from "@/components/ui";
import { TrendChart, TrendLegend } from "@/components/uploads-chart";
import { storageUsed } from "@/lib/api";
import { formatBytes, formatMoney, timeAgo, uiLocale } from "@/lib/format";
import { useStore } from "@/lib/store";
import { kpis, periodTotals, projectsByStatus, storageByCompany, trendByDay } from "@/lib/stats";
import type { DemoState, Project } from "@/lib/types";
import { useT } from "@/lib/i18n";

const DAY = 86_400_000;
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(uiLocale(), { month: "short", day: "numeric" });

function RangeSwitch({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("Date range")} className="inline-flex h-8 items-center rounded-md border border-border bg-surface p-0.5 shadow-card">
      {RANGES.map((r) => (
        <button key={r} aria-pressed={value === r} onClick={() => onChange(r)} className={cx("h-full rounded-[5px] px-2.5 text-xs font-medium transition-colors", value === r ? "bg-surface-3 text-text" : "text-muted hover:text-text")}>
          {t("{n}d", { n: r })}
        </button>
      ))}
    </div>
  );
}

/** One cell of the metric strip. */
function Metric({ label, value, sub, trend, children }: { label: string; value: string; sub?: React.ReactNode; trend?: number[]; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-surface p-4">
      <span className="text-muted">{label}</span>
      <span className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="mt-1 min-h-4 text-xs text-muted">{sub}</span>
      {trend && <Sparkline data={trend} className="mt-auto pt-3" />}
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}

// Cells sit on a 1px gap over the border colour, which draws the dividers at any column count.
const MetricStrip = ({ children }: { children: React.ReactNode }) => <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border lg:grid-cols-4">{children}</Card>;

const HeaderLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-0.5 text-muted hover:text-text">
    {children} <ChevronRight className="size-3.5" aria-hidden />
  </Link>
);

function ActivityList({ state, companyId, limit = 8 }: { state: DemoState; companyId?: string; limit?: number }) {
  const items = state.activity.filter((a) => !companyId || a.companyId === companyId).slice(0, limit);
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
          <Avatar name={state.users.find((u) => u.id === a.actorId)?.name ?? "?"} size={20} />
          <div className="min-w-0 flex-1">
            <ActivityText state={state} activity={a} />
          </div>
          <time dateTime={a.at} className="shrink-0 text-xs text-faint">
            {timeAgo(a.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function DueSoon({ state, projects }: { state: DemoState; projects: Project[] }) {
  const t = useT();
  const [now] = useState(() => Date.now());
  const list = projects
    .filter((p) => p.status !== "completed")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  return (
    <ul className="divide-y divide-border">
      {list.map((p) => {
        const late = Date.parse(p.dueDate) < now;
        return (
          <li key={p.id} className="flex items-center gap-2.5 px-4 py-2.5">
            <StatusIcon status={p.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted">{state.companies.find((c) => c.id === p.companyId)?.name}</p>
            </div>
            <span className={cx("shrink-0 text-xs tabular-nums", late ? "text-danger" : "text-muted")}>
              {late ? t("Overdue {n}d", { n: Math.ceil((now - Date.parse(p.dueDate)) / DAY) }) : shortDate(p.dueDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusList({ state, companyId }: { state: DemoState; companyId?: string }) {
  const t = useT();
  const statuses = projectsByStatus(state, companyId);
  const max = Math.max(1, ...statuses.map((s) => s.count));
  return (
    <ul className="space-y-3 p-4">
      {statuses.map((s) => (
        <li key={s.status} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2">
            <StatusIcon status={s.status} />
            {t(STATUS_NAME[s.status])}
          </span>
          <span className="text-right text-muted tabular-nums">{s.count}</span>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(s.count / max) * 100}%`, background: STATUS_COLOR[s.status] }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function AdminDashboard({ state }: { state: DemoState }) {
  const t = useT();
  const [range, setRange] = useState<Range>(30);
  const k = useMemo(() => kpis(state), [state]);
  const trend = useMemo(() => trendByDay(state, 30), [state]);
  const storage = useMemo(() => storageByCompany(state).slice(0, 6), [state]);
  const shown = trend.slice(-range);
  const uploads7 = periodTotals(trend, "uploads", 7);
  const logins7 = periodTotals(trend, "logins", 7);
  const uploadsInRange = shown.reduce((s, p) => s + p.uploads, 0);

  return (
    <>
      <PageHeader title={t("Dashboard")} description={t("Activity across {n} clients, last {days} days.", { n: state.companies.length, days: range })} actions={<RangeSwitch value={range} onChange={setRange} />} />

      <MetricStrip>
        <Metric label={t("Active clients")} value={String(k.activeClients)} sub={t("of {n} · {m} onboarding", { n: state.companies.length, m: state.companies.filter((c) => c.status === "onboarding").length })}>
          <div className="flex -space-x-1">
            {state.companies.map((c) => (
              <span key={c.id} title={c.name}>
                <Avatar name={c.name} size={22} square />
              </span>
            ))}
          </div>
        </Metric>
        <Metric label={t("Active users")} value={String(k.activeUsers)} sub={<Delta current={logins7.current} previous={logins7.previous} label={t("sign-ins vs last week")} />} trend={shown.map((p) => p.logins)} />
        <Metric label={t("Open projects")} value={String(k.openProjects)} sub={t("{amount} open budget", { amount: formatMoney(k.pipelineValue) })}>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {projectsByStatus(state)
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.status} className="h-full" style={{ flex: s.count, background: STATUS_COLOR[s.status] }} />
              ))}
          </div>
        </Metric>
        <Metric label={t("Uploads, {n} days", { n: range })} value={String(uploadsInRange)} sub={<Delta current={uploads7.current} previous={uploads7.previous} label={t("vs last week")} />} trend={shown.map((p) => p.uploads)} />
      </MetricStrip>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("Uploads and sign-ins")} meta={<TrendLegend />} />
          <div className="px-4 pt-3 pb-2">
            <TrendChart data={shown} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Projects by status")} meta={<HeaderLink href="/projects">{t("View board")}</HeaderLink>} />
          <StatusList state={state} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title={t("Storage by client")} meta={<HeaderLink href="/clients">{t("All clients")}</HeaderLink>} />
          <ul className="divide-y divide-border">
            {storage.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={c.name} size={22} square />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex justify-between gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {formatBytes(c.used)} / {formatBytes(c.quota)}
                    </span>
                  </div>
                  <Meter value={c.used} max={c.quota} label={t("{name} storage used", { name: c.name })} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t("Due soon")} meta={t("{n} open", { n: k.openProjects })} />
          <DueSoon state={state} projects={state.projects} />
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title={t("Recent activity")} meta={<HeaderLink href="/activity">{t("Full log")}</HeaderLink>} />
          <ActivityList state={state} limit={6} />
        </Card>
      </div>
    </>
  );
}

function ClientDashboard({ state, companyId }: { state: DemoState; companyId: string }) {
  const t = useT();
  const company = state.companies.find((c) => c.id === companyId)!;
  const projects = state.projects.filter((p) => p.companyId === company.id);
  const files = state.files.filter((f) => f.companyId === company.id);
  const used = storageUsed(state, company.id);
  const trend = trendByDay(state, 30, undefined, company.id);
  const uploads7 = periodTotals(trend, "uploads", 7);
  const team = state.users.filter((u) => u.companyId === company.id && u.status !== "disabled");

  return (
    <>
      <PageHeader title={t("Dashboard")} description={`${company.name} · ${t("{plan} plan", { plan: t(company.plan) })}`} />
      <MetricStrip>
        <Metric label={t("Projects")} value={String(projects.length)} sub={t("{n} in progress", { n: projects.filter((p) => p.status !== "completed").length })} />
        <Metric label={t("Files")} value={String(files.length)} sub={<Delta current={uploads7.current} previous={uploads7.previous} label={t("uploads vs last week")} />} trend={trend.map((p) => p.uploads)} />
        <Metric label={t("Storage used")} value={formatBytes(used)} sub={t("of {quota}", { quota: formatBytes(company.quota) })} />
        <Metric label={t("Team members")} value={String(team.length)} sub={t("{n} pending invites", { n: team.filter((u) => u.status === "invited").length })} />
      </MetricStrip>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title={t("Your projects")} meta={<HeaderLink href="/projects">{t("All projects")}</HeaderLink>} />
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon status={p.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{t(STATUS_NAME[p.status])}</p>
                  </div>
                  <span className="hidden text-xs text-muted sm:inline">{t("Due {date}", { date: shortDate(p.dueDate) })}</span>
                  <ProgressRing value={p.progress} label={t("{name} progress", { name: p.name })} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={t("Uploads and sign-ins")} meta={<TrendLegend />} />
            <div className="px-4 pt-3 pb-2">
              <TrendChart data={trend} height={180} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">{t("Storage")}</h2>
              <span className="text-xs text-muted tabular-nums">
                {formatBytes(used)} / {formatBytes(company.quota)}
              </span>
            </div>
            <Meter value={used} max={company.quota} label={t("{name} storage overview", { name: company.name })} className="mt-3" />
            <Link href="/files" className="mt-3 inline-flex items-center gap-0.5 text-muted hover:text-text">
              {t("Open file portal")} <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </Card>
          <Card>
            <CardHeader title={t("Recent activity")} />
            <ActivityList state={state} companyId={company.id} limit={7} />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { state, user } = useStore();
  if (!state || !user) return null;
  return user.role === "admin" || !user.companyId ? <AdminDashboard state={state} /> : <ClientDashboard state={state} companyId={user.companyId} />;
}
