"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/stats";

const SERIES = [
  { key: "uploads", label: "Uploads", color: "var(--chart-1)" },
  { key: "logins", label: "Sign-ins", color: "var(--chart-2)" },
] as const;

export function TrendLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">{label}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
          <span className="text-muted">{s.label}</span>
          <span className="ml-auto pl-4 font-mono font-medium tabular-nums">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

/** Uploads and sign-ins per day. A table view sits next to it for screen readers. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const total = data.reduce((s, d) => s + d.uploads, 0);
  return (
    <figure>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} dy={6} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={44} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "4 4" }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                animationDuration={1100}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {total} uploads in the last {data.length} days.
      </figcaption>
      <table className="sr-only">
        <caption>Uploads and sign-ins per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Uploads</th>
            <th scope="col">Sign-ins</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.uploads}</td>
              <td>{d.logins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export const STATUS_COLOR: Record<string, string> = {
  planning: "var(--chart-5)",
  active: "var(--chart-1)",
  review: "var(--chart-3)",
  "on-hold": "var(--chart-4)",
  completed: "var(--chart-2)",
};

/** Donut with the total in the middle; the legend next to it lists every value. */
export function StatusDonut({ data }: { data: Array<{ status: string; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="relative mx-auto size-44" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.filter((d) => d.count > 0)} dataKey="count" nameKey="status" innerRadius="70%" outerRadius="100%" paddingAngle={3} cornerRadius={4} stroke="none" animationDuration={1000}>
            {data
              .filter((d) => d.count > 0)
              .map((d) => (
                <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
              ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums">{total}</p>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">projects</p>
        </div>
      </div>
    </div>
  );
}
