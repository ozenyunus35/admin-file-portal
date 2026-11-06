"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/stats";
import { useT } from "@/lib/i18n";

const SERIES = [
  { key: "uploads", label: "Uploads", color: "var(--accent)" },
  { key: "logins", label: "Sign-ins", color: "var(--border-strong)" },
] as const;

export function TrendLegend() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {t(s.label)}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-md bg-surface px-2.5 py-2 text-xs shadow-pop">
      <p className="mb-1 text-faint">{label}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2">
          <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          <span className="text-muted">{t(s.label)}</span>
          <span className="ml-auto font-medium tabular-nums">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

/** Daily uploads and sign-ins as grouped bars. A table view sits next to it for screen readers. */
export function TrendChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const t = useT();
  const total = data.reduce((s, d) => s + d.uploads, 0);
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={1} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={32} dy={4} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11 }} width={28} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} isAnimationActive={false} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={10} animationDuration={400} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {t("{n} uploads in the last {days} days.", { n: total, days: data.length })}
      </figcaption>
      <table className="sr-only">
        <caption>{t("Uploads and sign-ins per day")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Date")}</th>
            <th scope="col">{t("Uploads")}</th>
            <th scope="col">{t("Sign-ins")}</th>
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
