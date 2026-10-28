"use client";

import { ArrowRight, BarChart3, Check, FileLock2, Link2, Mail, ShieldCheck, Sparkles, UploadCloud, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, Button, Field, cx, inputClass } from "@/components/ui";
import { log } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID } from "@/lib/seed";
import { getState, setSession, setState, useStore } from "@/lib/store";

const FEATURES = [
  { icon: BarChart3, title: "Live dashboard", text: "KPIs, trends and storage per client" },
  { icon: Users, title: "User management", text: "Search, filter, roles, CSV export" },
  { icon: FileLock2, title: "Client file portal", text: "Upload, PDF preview, share links" },
  { icon: ShieldCheck, title: "Role-based access", text: "Admin and client views, audit log" },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Recharts", "PDF.js", "Playwright"];

/** Decorative product preview on the hero: a few floating UI cards with gentle motion. */
function HeroPreview() {
  const bars = [38, 52, 44, 66, 58, 74, 63, 82, 71, 90, 78, 96];
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[520px] [perspective:1400px]" aria-hidden>
      <div className="absolute inset-x-6 top-4 rounded-2xl border border-white/10 bg-[#0e131a]/90 p-5 shadow-2xl shadow-black/60 backdrop-blur [transform:rotateX(8deg)_rotateY(-10deg)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Files shared this quarter</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">1,284</p>
          </div>
          <span className="rounded-md bg-emerald-400/10 px-2 py-1 font-mono text-[11px] text-emerald-300">▲ 18%</span>
        </div>
        <div className="mt-5 flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 origin-bottom animate-[enter_0.6s_ease-out_both] rounded-t bg-gradient-to-t from-[#818cf8]/40 to-[#5eead4]" style={{ height: `${h}%`, animationDelay: `${300 + i * 45}ms` }} />
          ))}
        </div>
      </div>

      <div className="absolute top-[150px] -left-2 w-60 animate-float rounded-2xl border border-white/10 bg-[#121821]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur sm:-left-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-[#5eead4]/15 text-[#5eead4]">
            <UploadCloud className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Brand guidelines.pdf</p>
            <p className="font-mono text-[10px] text-slate-400">3.2 MB · uploading</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[72%] animate-[fill_2.4s_ease-out_both] rounded-full bg-gradient-to-r from-[#818cf8] to-[#5eead4]" />
        </div>
      </div>

      <div className="absolute top-[176px] -right-2 w-56 animate-float rounded-2xl border border-white/10 bg-[#121821]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur [animation-delay:-3s] sm:-right-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Link2 className="size-4 text-[#a5b4fc]" /> Share link created
        </div>
        <p className="mt-2 truncate rounded-md bg-white/5 px-2 py-1.5 font-mono text-[10px] text-slate-300">atlas.example/share/#k3Vq…</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {["Jordan Park", "Elena Novak", "Omar Haddad"].map((n) => (
              <Avatar key={n} name={n} size={22} />
            ))}
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-300">
            <Check className="size-3" /> expires in 7d
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { state, user, ready } = useStore();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  const signIn = (id: string) => {
    const u = getState().users.find((x) => x.id === id)!;
    setState(log(getState(), u, "auth.login", u.email, u.companyId));
    setSession(id);
    router.push("/dashboard");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = state?.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return setError("No demo account uses this email. Try one of the buttons above.");
    if (u.status === "disabled") return setError("This account is disabled. An admin can re-enable it on the Users page.");
    signIn(u.id);
  };

  const admin = state?.users.find((u) => u.id === DEMO_ADMIN_ID);
  const client = state?.users.find((u) => u.id === DEMO_CLIENT_ID);
  const clientCompany = state?.companies.find((c) => c.id === client?.companyId);

  const roles = [
    { u: admin, role: "Admin", sub: admin?.title, desc: "Every client, user, project and file, plus the audit log.", points: ["Dashboard & charts", "Users & roles", "Activity log"], accent: "from-[#5eead4] to-[#2dd4bf]" },
    { u: client, role: "Client", sub: clientCompany?.name, desc: "One company's projects and its private file portal.", points: ["Project progress", "File portal", "Share links"], accent: "from-[#a5b4fc] to-[#818cf8]" },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-[#07090d] p-10 text-white lg:flex xl:px-14">
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black_20%,transparent_70%)]" aria-hidden />
        <div className="absolute -top-40 -left-32 size-[560px] rounded-full bg-[#5eead4]/12 blur-[120px]" aria-hidden />
        <div className="absolute -right-40 -bottom-40 size-[560px] rounded-full bg-[#818cf8]/14 blur-[120px]" aria-hidden />

        <div className="relative flex items-center justify-between">
          <Logo sub="Admin & client portal" />
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-300 backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#5eead4] opacity-70" />
              <span className="relative size-1.5 rounded-full bg-[#5eead4]" />
            </span>
            Live demo
          </span>
        </div>

        <div className="relative">
          <h1 className="stagger max-w-xl font-display text-[44px] leading-[1.05] font-semibold tracking-tight xl:text-5xl [@media(min-height:1000px)]:xl:text-6xl">
            The client portal your team <span className="text-gradient">actually enjoys</span> using.
          </h1>
          <p className="stagger mt-5 max-w-md text-base text-slate-400" style={{ "--d": "80ms" } as React.CSSProperties}>
            Dashboard, user management and a secure file portal for every client, in one fast web app.
          </p>
          <div className="stagger mt-8" style={{ "--d": "160ms" } as React.CSSProperties}>
            <HeroPreview />
          </div>
          <ul className="mt-10 hidden max-w-xl grid-cols-2 gap-x-6 gap-y-4 [@media(min-height:1000px)]:grid">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="stagger flex gap-3" style={{ "--d": `${260 + i * 60}ms` } as React.CSSProperties}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                  <f.icon className="size-4 text-[#5eead4]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-xs text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="relative flex flex-wrap gap-2">
          {STACK.map((s) => (
            <li key={s} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-slate-400">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:invisible">
            <Logo />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-md">
            <p className="stagger mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[11px] font-medium text-accent">
              <Sparkles className="size-3" aria-hidden /> No sign-up · synthetic data
            </p>
            <h2 className="stagger font-display text-3xl font-semibold tracking-tight" style={{ "--d": "40ms" } as React.CSSProperties}>
              Try the live demo
            </h2>
            <p className="stagger mt-2 text-sm text-muted" style={{ "--d": "80ms" } as React.CSSProperties}>
              Pick a role and explore. Everything runs in your browser, nothing is sent anywhere.
            </p>

            <div className="mt-7 grid gap-3">
              {roles.map(({ u, role, sub, desc, points, accent }, i) => (
                <button
                  key={role}
                  disabled={!u || u.status === "disabled"}
                  onClick={() => u && signIn(u.id)}
                  className="stagger group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 text-left shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_16px_40px_-16px_var(--accent)] disabled:opacity-50"
                  style={{ "--d": `${140 + i * 70}ms` } as React.CSSProperties}
                >
                  <span className={cx("absolute inset-y-0 left-0 w-1 bg-gradient-to-b opacity-60 transition-opacity group-hover:opacity-100", accent)} aria-hidden />
                  <span className="flex items-center gap-4">
                    {u ? <Avatar name={u.name} size={46} /> : <span className="size-11 rounded-full bg-surface-2" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold">Try as {role.toLowerCase()}</span>
                      <span className="block truncate text-sm text-muted">{u ? `${u.name}, ${sub}` : "Loading…"}</span>
                    </span>
                    <span className="grid size-9 place-items-center rounded-full border border-border transition-all duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg">
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </span>
                  <span className="mt-3 block text-xs text-muted">{desc}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {points.map((p) => (
                      <span key={p} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                        {p}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="my-7 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              or sign in with any demo email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-3">
              <Field label="Email" error={error} hint="e.g. daniel@atlasportal.example">
                {(id, describedBy) => (
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                    <input
                      id={id}
                      type="email"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(undefined);
                      }}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      className={cx(inputClass, "pl-9")}
                      placeholder="name@company.example"
                    />
                  </div>
                )}
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={!ready}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
