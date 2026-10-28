import type {
  Activity,
  ActivityAction,
  Company,
  DemoState,
  FileItem,
  Folder,
  Project,
  ProjectStatus,
  SeedKind,
  User,
} from "./types";

/**
 * Builds the demo dataset. Every company, person and file here is invented;
 * emails use the reserved `.example` domain. Dates are relative to `now`, so
 * the dashboard always looks current, and the PRNG is seeded so the same
 * `now` always gives the same data.
 */

export const STATE_VERSION = 3;
export const DEMO_ADMIN_ID = "u-admin-1";
export const DEMO_CLIENT_ID = "u-client-demo";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const KB = 1024;
const DAY = 86_400_000;

export const PLAN_QUOTA: Record<Company["plan"], number> = {
  Starter: 2 * GB,
  Growth: 5 * GB,
  Enterprise: 25 * GB,
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = ReturnType<typeof mulberry32>;
const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const COMPANIES: Array<Omit<Company, "id" | "quota" | "createdAt"> & { slug: string }> = [
  { slug: "brightline", name: "Brightline Dental Group", industry: "Healthcare", country: "United States", status: "active", plan: "Starter" },
  { slug: "northgate", name: "Northgate Logistics", industry: "Logistics", country: "Germany", status: "active", plan: "Enterprise" },
  { slug: "falconcrest", name: "Falcon Crest Realty", industry: "Real estate", country: "United Arab Emirates", status: "active", plan: "Growth" },
  { slug: "lumenash", name: "Lumen & Ash Studio", industry: "Design", country: "United Kingdom", status: "onboarding", plan: "Starter" },
  { slug: "tidewater", name: "Tidewater Analytics", industry: "SaaS", country: "Singapore", status: "active", plan: "Growth" },
  { slug: "kestrel", name: "Kestrel Legal LLP", industry: "Legal", country: "United States", status: "active", plan: "Growth" },
  { slug: "orchardlane", name: "Orchard Lane Foods", industry: "Retail", country: "Netherlands", status: "paused", plan: "Starter" },
  { slug: "summitpeak", name: "Summit Peak Fitness", industry: "Fitness", country: "Canada", status: "onboarding", plan: "Starter" },
];

const ADMINS: Array<Pick<User, "id" | "name" | "title">> = [
  { id: DEMO_ADMIN_ID, name: "Maya Chen", title: "Operations Lead" },
  { id: "u-admin-2", name: "Daniel Okafor", title: "Account Manager" },
  { id: "u-admin-3", name: "Priya Raman", title: "Project Manager" },
  { id: "u-admin-4", name: "Lucas Weber", title: "Support Engineer" },
];

const FIRST = ["Avery", "Noah", "Elena", "Omar", "Sofia", "Ethan", "Leila", "Marcus", "Hannah", "Ravi", "Chloe", "Tomas", "Aisha", "Felix", "Grace", "Hugo", "Nadia", "Samuel", "Isla", "Kenji", "Lena", "Mateo", "Zara", "Owen"];
const LAST = ["Brooks", "Hartley", "Novak", "Haddad", "Lindqvist", "Moreau", "Tanaka", "Reyes", "Fischer", "Abara", "Quinn", "Delgado", "Sato", "Whitaker", "Kovacs", "Ellison", "Varga", "Castillo", "Nakamura", "Osei"];
const CLIENT_TITLES = ["Operations Manager", "Marketing Director", "Office Manager", "CEO", "Finance Lead", "IT Coordinator", "Head of Product"];

const PROJECT_NAMES = ["Website redesign", "Client portal rollout", "Brand refresh", "Inventory dashboard", "Booking system", "SEO migration", "Mobile app MVP", "Data warehouse setup", "Email automation", "Analytics audit"];
const FOLDERS = ["Contracts", "Design", "Reports", "Invoices", "Shared"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SEED_MIME: Record<SeedKind, string> = {
  pdf: "application/pdf",
  image: "image/svg+xml",
  csv: "text/csv",
  text: "text/markdown",
  archive: "application/zip",
};

const SIZE_RANGE: Record<SeedKind, [number, number]> = {
  pdf: [120 * KB, 4 * MB],
  image: [300 * KB, 6 * MB],
  csv: [20 * KB, 2 * MB],
  text: [2 * KB, 30 * KB],
  archive: [180 * MB, 640 * MB],
};

function fileTemplates(folder: (typeof FOLDERS)[number], rng: Rng, project: string, now: Date): Array<[string, SeedKind]> {
  const month = MONTHS[(now.getMonth() + 11 - between(rng, 0, 3)) % 12];
  const inv = String(between(rng, 10, 99)).padStart(3, "0");
  switch (folder) {
    case "Contracts":
      return [["Master Services Agreement.pdf", "pdf"], [`SOW - ${project}.pdf`, "pdf"], ["NDA - signed.pdf", "pdf"]];
    case "Design":
      return [["Homepage mockup v3.svg", "image"], ["Logo concepts.svg", "image"], ["Brand guidelines.pdf", "pdf"], ["Source assets.zip", "archive"]];
    case "Reports":
      return [[`Monthly report - ${month}.pdf`, "pdf"], [`Analytics export - ${month}.csv`, "csv"], ["Kickoff meeting notes.md", "text"], ["Database backup.zip", "archive"]];
    case "Invoices":
      return [[`Invoice INV-${now.getFullYear()}-${inv}.pdf`, "pdf"], [`Invoice INV-${now.getFullYear()}-${String(Number(inv) + 1).padStart(3, "0")}.pdf`, "pdf"]];
    case "Shared":
      return [["Onboarding checklist.md", "text"], ["Team photo.svg", "image"], ["Photo shoot - raw files.zip", "archive"]];
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Milliseconds before `t` within the last `days` days, shaped like real usage:
 * weekdays busier than weekends, working hours busier than nights, and a
 * gentle upward trend towards today.
 */
function recentOffset(rng: Rng, t: number, days: number): number {
  for (;;) {
    const ago = rng() * days * DAY;
    const at = new Date(t - ago);
    const weekend = at.getDay() === 0 || at.getDay() === 6;
    const h = at.getHours();
    const weight = (weekend ? 0.3 : 1) * (h >= 8 && h <= 19 ? 1 : 0.15) * (0.45 + 0.55 * (1 - ago / (days * DAY)));
    if (rng() < weight) return ago;
  }
}

const STATUS_WEIGHTS: Array<[ProjectStatus, number]> = [
  ["planning", 0.14],
  ["active", 0.42],
  ["review", 0.2],
  ["completed", 0.18],
  ["on-hold", 0.06],
];

function pickStatus(rng: Rng): ProjectStatus {
  let r = rng();
  for (const [status, w] of STATUS_WEIGHTS) if ((r -= w) < 0) return status;
  return "active";
}

export function createSeed(now: Date = new Date(), seed = 20261028): DemoState {
  const rng = mulberry32(seed);
  const t = now.getTime();

  const companies: Company[] = COMPANIES.map(({ slug, ...c }, i) => ({
    ...c,
    id: `c-${slug}`,
    quota: PLAN_QUOTA[c.plan],
    createdAt: iso(t - (360 - i * 40) * DAY - between(rng, 0, 20) * DAY),
  }));

  const users: User[] = ADMINS.map((a, i) => ({
    ...a,
    email: `${a.name.split(" ")[0].toLowerCase()}@atlasportal.example`,
    role: "admin",
    companyId: null,
    status: "active",
    createdAt: iso(t - (400 - i * 30) * DAY),
    lastActiveAt: iso(t - between(rng, 0, 36) * 3_600_000),
  }));

  const usedNames = new Set<string>();
  COMPANIES.forEach((c, ci) => {
    const company = companies[ci];
    const count = between(rng, 3, 5);
    for (let k = 0; k < count; k++) {
      const isDemo = ci === 0 && k === 0;
      let name = "Jordan Park";
      if (!isDemo) {
        do name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
        while (usedNames.has(name));
      }
      usedNames.add(name);
      const created = Date.parse(company.createdAt) + between(rng, 0, 60) * DAY;
      const roll = rng();
      const status = isDemo ? "active" : company.status === "paused" ? "disabled" : roll < 0.12 ? "invited" : roll < 0.18 ? "disabled" : "active";
      const [first, last] = name.toLowerCase().split(" ");
      users.push({
        id: isDemo ? DEMO_CLIENT_ID : `u-${c.slug}-${k}`,
        name,
        email: `${first}.${last}@${c.slug}.example`,
        role: "client",
        title: isDemo ? "Practice Manager" : pick(rng, CLIENT_TITLES),
        companyId: company.id,
        status,
        createdAt: iso(Math.min(created, t - DAY)),
        lastActiveAt: status === "invited" ? null : iso(t - between(rng, 1, 24 * 20) * 3_600_000),
      });
    }
  });

  const projects: Project[] = [];
  companies.forEach((company, ci) => {
    const count = between(rng, 2, 4);
    const names = shuffle(rng, PROJECT_NAMES).slice(0, count);
    names.forEach((name, k) => {
      const status: ProjectStatus = company.status === "paused" ? (k === 0 ? "on-hold" : "completed") : company.status === "onboarding" ? (k === 0 ? "active" : "planning") : pickStatus(rng);
      const start = t - between(rng, 20, 160) * DAY;
      // Open work is mostly due in the coming weeks (a couple slightly late); finished work was due in the past.
      const due = status === "completed" ? t - between(rng, 3, 60) * DAY : t + between(rng, status === "on-hold" ? -10 : -4, 80) * DAY;
      projects.push({
        id: `p-${ci}-${k}`,
        name,
        companyId: company.id,
        ownerId: pick(rng, ADMINS).id,
        status,
        budget: between(rng, 8, 90) * 500,
        progress: status === "completed" ? 100 : status === "planning" ? between(rng, 0, 15) : status === "review" ? between(rng, 80, 96) : between(rng, 25, 85),
        startDate: iso(Math.min(start, due - 30 * DAY)),
        dueDate: iso(due),
      });
    });
  });

  const folders: Folder[] = [];
  const files: FileItem[] = [];
  companies.forEach((company) => {
    const companyProjects = projects.filter((p) => p.companyId === company.id);
    const uploaders = [...ADMINS.map((a) => a.id), ...users.filter((u) => u.companyId === company.id && u.status === "active").map((u) => u.id)];
    FOLDERS.forEach((folderName) => {
      const folder: Folder = { id: `f-${company.id.slice(2)}-${folderName.toLowerCase()}`, companyId: company.id, name: folderName };
      folders.push(folder);
      if (company.status === "onboarding" && folderName !== "Contracts" && folderName !== "Shared") return;
      for (const [name, kind] of fileTemplates(folderName, rng, companyProjects[0]?.name ?? "Engagement", now)) {
        if (rng() < 0.15) continue;
        const [min, max] = SIZE_RANGE[kind];
        files.push({
          id: `file-${files.length + 1}`,
          companyId: company.id,
          folderId: folder.id,
          name,
          mime: SEED_MIME[kind],
          size: between(rng, min, max),
          uploadedBy: pick(rng, uploaders),
          createdAt: iso(t - recentOffset(rng, t, 29)),
          seed: kind,
        });
      }
    });
  });

  const activity: Activity[] = [];
  const actions: ActivityAction[] = ["auth.login", "auth.login", "auth.login", "file.download", "file.download", "project.update", "user.update", "file.share"];
  for (const f of files) {
    activity.push({ id: "", at: f.createdAt, actorId: f.uploadedBy, action: "file.upload", target: f.name, companyId: f.companyId });
  }
  for (let i = 0; i < 520; i++) {
    const actor = pick(rng, users.filter((u) => u.status === "active"));
    const action = pick(rng, actions);
    const companyId = actor.companyId ?? pick(rng, companies).id;
    const target =
      action === "auth.login"
        ? actor.email
        : action === "project.update"
          ? pick(rng, projects.filter((p) => p.companyId === companyId)).name
          : action === "user.update"
            ? pick(rng, users.filter((u) => u.companyId === companyId && u.id !== actor.id).concat(users.filter((u) => u.role === "client" && u.id !== actor.id))).name
            : pick(rng, files.filter((f) => f.companyId === companyId).concat(files)).name;
    activity.push({ id: "", at: iso(t - recentOffset(rng, t, 29)), actorId: actor.id, action, target, companyId: action === "auth.login" ? actor.companyId : companyId });
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));
  activity.forEach((a, i) => (a.id = `a-${activity.length - i}`));

  return { version: STATE_VERSION, seededAt: iso(t), companies, users, projects, folders, files, shares: [], activity };
}
