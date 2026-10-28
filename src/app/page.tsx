"use client";

import { ArrowRight, BarChart3, FileLock2, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, Button, Card, Field, inputClass } from "@/components/ui";
import { log } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID } from "@/lib/seed";
import { getState, setSession, setState, useStore } from "@/lib/store";

const FEATURES = [
  { icon: BarChart3, text: "Dashboard with KPIs, upload trends and storage per client" },
  { icon: Users, text: "User management: search, filters, sorting, roles, CSV export" },
  { icon: FileLock2, text: "Client file portal: drag-and-drop upload, preview, share links" },
  { icon: ShieldCheck, text: "Role-based access and a full activity log" },
];

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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0F1419] p-12 text-white lg:flex">
        <div className="absolute -top-40 -right-40 size-[480px] rounded-full bg-[#5EEAD4]/10 blur-3xl" aria-hidden />
        <div className="relative [&_span.grid]:bg-[#5EEAD4] [&_span.grid]:text-[#042f2e]">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight">Admin dashboard and client file portal, in one place.</h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex gap-3 text-sm text-slate-300">
                <f.icon className="size-5 shrink-0 text-[#5EEAD4]" aria-hidden />
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-xs text-slate-500">Next.js · TypeScript · Tailwind CSS · mock backend in the browser</p>
      </section>

      <section className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:invisible">
            <Logo />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-semibold tracking-tight">Try the live demo</h2>
            <p className="mt-2 text-sm text-muted">No sign-up and no password. Pick a role to explore; everything runs in your browser with synthetic data.</p>

            <div className="mt-6 grid gap-3">
              {[
                { u: admin, role: "Admin", sub: admin?.title, desc: "All clients, users, projects, files and the activity log" },
                { u: client, role: "Client", sub: clientCompany?.name, desc: "Own projects and the company's file portal only" },
              ].map(({ u, role, sub, desc }) => (
                <Card key={role} className="p-0">
                  <button
                    disabled={!u || u.status === "disabled"}
                    onClick={() => u && signIn(u.id)}
                    className="flex w-full items-center gap-4 rounded-xl p-4 text-left hover:bg-surface-2 disabled:opacity-50"
                  >
                    {u ? <Avatar name={u.name} size={44} /> : <span className="size-11 rounded-full bg-surface-2" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Try as {role.toLowerCase()}</span>
                      <span className="block truncate text-sm text-muted">
                        {u ? `${u.name}, ${sub}` : "Loading…"}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{desc}</span>
                    </span>
                    <ArrowRight className="size-5 text-muted" aria-hidden />
                  </button>
                </Card>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              or sign in with any demo email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-3">
              <Field label="Email" error={error} hint="e.g. daniel@atlasportal.example">
                {(id, describedBy) => (
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
                    className={inputClass}
                    placeholder="name@company.example"
                  />
                )}
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={!ready}>
                Continue
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
