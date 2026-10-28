"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, Button, Field, inputClass } from "@/components/ui";
import { log } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID } from "@/lib/seed";
import { getState, setSession, setState, useStore } from "@/lib/store";

const SOURCE_URL = "https://github.com/ozenyunus35/admin-file-portal";

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
    { u: admin, role: "admin", who: admin && `${admin.name}, ${admin.title}`, desc: "All clients, users, projects, files and the audit log" },
    { u: client, role: "client", who: client && `${client.name}, ${clientCompany?.name}`, desc: "One company's projects and its private file portal" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-3">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[380px] animate-enter">
          <LogoMark size={32} />
          <h1 className="mt-6 text-xl font-semibold tracking-[-0.01em]">Try the live demo</h1>
          <p className="mt-1.5 text-muted">Atlas Portal is an admin dashboard and client file portal. Pick a role to explore; all data is synthetic and stays in your browser.</p>

          <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            {roles.map(({ u, role, who, desc }, i) => (
              <button
                key={role}
                disabled={!u || u.status === "disabled"}
                onClick={() => u && signIn(u.id)}
                className={`group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50 ${i ? "border-t border-border" : ""}`}
              >
                {u ? <Avatar name={u.name} size={32} /> : <span className="size-8 rounded-full bg-surface-3" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Try as {role}</span>
                  <span className="block truncate text-xs text-muted">{who ?? "Loading…"}</span>
                  <span className="block text-xs text-faint">{desc}</span>
                </span>
                <ChevronRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text" aria-hidden />
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-faint">
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
                  className={`${inputClass} h-9`}
                  placeholder="name@company.example"
                />
              )}
            </Field>
            <Button type="submit" variant="primary" className="h-9 w-full" disabled={!ready}>
              Continue
            </Button>
          </form>

          <p className="mt-10 text-xs text-faint">
            Next.js · TypeScript · mock backend in the browser ·{" "}
            <a href={SOURCE_URL} className="text-muted underline-offset-2 hover:text-text hover:underline">
              Source code
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
