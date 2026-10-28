"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single series, so no legend: the card title names it. A table view sits next to it for screen readers. */
export function UploadsChart({ data }: { data: Array<{ date: string; label: string; uploads: number }> }) {
  const total = data.reduce((s, d) => s + d.uploads, 0);
  return (
    <figure>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={48} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
              labelStyle={{ color: "var(--muted)" }}
              formatter={(v) => [`${v} files`, "Uploads"]}
            />
            <Bar dataKey="uploads" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {total} uploads in the last {data.length} days.
      </figcaption>
      <table className="sr-only">
        <caption>Uploads per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Uploads</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.uploads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
