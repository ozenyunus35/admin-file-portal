import { storageUsed } from "./api";
import type { DemoState, ProjectStatus } from "./types";

const DAY = 86_400_000;

export interface Kpis {
  activeClients: number;
  activeUsers: number;
  openProjects: number;
  pipelineValue: number;
  filesLast30: number;
  storageUsed: number;
  storageQuota: number;
}

export function kpis(state: DemoState, now = Date.now()): Kpis {
  const open = state.projects.filter((p) => p.status !== "completed");
  return {
    activeClients: state.companies.filter((c) => c.status === "active").length,
    activeUsers: state.users.filter((u) => u.status === "active").length,
    openProjects: open.length,
    pipelineValue: open.reduce((s, p) => s + p.budget, 0),
    filesLast30: state.files.filter((f) => now - Date.parse(f.createdAt) <= 30 * DAY).length,
    storageUsed: state.files.reduce((s, f) => s + f.size, 0),
    storageQuota: state.companies.reduce((s, c) => s + c.quota, 0),
  };
}

/** Uploads per day for the last `days` days, oldest first. */
export function uploadsByDay(state: DemoState, days = 30, now = new Date()): Array<{ date: string; label: string; uploads: number }> {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(end - (days - 1 - i) * DAY);
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), uploads: 0, start: d.getTime() };
  });
  for (const f of state.files) {
    const t = Date.parse(f.createdAt);
    const idx = Math.floor((t - out[0].start) / DAY);
    if (idx >= 0 && idx < days) out[idx].uploads++;
  }
  return out.map(({ date, label, uploads }) => ({ date, label, uploads }));
}

export function storageByCompany(state: DemoState) {
  return state.companies
    .map((c) => ({ id: c.id, name: c.name, used: storageUsed(state, c.id), quota: c.quota }))
    .sort((a, b) => b.used - a.used);
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["planning", "active", "review", "on-hold", "completed"];

export function projectsByStatus(state: DemoState, companyId?: string) {
  const counts = Object.fromEntries(PROJECT_STATUS_ORDER.map((s) => [s, 0])) as Record<ProjectStatus, number>;
  for (const p of state.projects) if (!companyId || p.companyId === companyId) counts[p.status]++;
  return PROJECT_STATUS_ORDER.map((status) => ({ status, count: counts[status] }));
}
