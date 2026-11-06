"use client";

import { Database, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, Card, Modal, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { resetDemo, useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  const { state, user } = useStore();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  if (!state || !user) return null;
  const company = state.companies.find((c) => c.id === user.companyId);

  return (
    <>
      <PageHeader title={t("Settings")} />
      <div className="grid max-w-3xl gap-6">
        <Card className="p-5">
          <h2 className="font-medium">{t("Profile")}</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={user.name} size={56} />
            <div className="min-w-0">
              <p className="font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge tone={user.role === "admin" ? "accent" : "neutral"}>{user.role}</Badge>
                {user.title}
                {company && ` · ${company.name}`}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-medium">{t("Appearance")}</h2>
            <p className="mt-1 text-sm text-muted">{t("Switch between light and dark theme. The choice is saved in this browser.")}</p>
          </div>
          <ThemeToggle />
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Database className="size-4" aria-hidden /> {t("Demo data")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("This demo has no server. Records are stored in localStorage and uploaded files in IndexedDB, only in this browser. Data was seeded {date}.", { date: formatDateTime(state.seededAt) })}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Clients", state.companies.length],
              ["Users", state.users.length],
              ["Files", state.files.length],
              ["Log entries", state.activity.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface-2 p-3">
                <dt className="text-xs text-muted">{t(String(k))}</dt>
                <dd className="text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="danger" className="mt-4" onClick={() => setConfirm(true)}>
            <RotateCcw className="size-4" /> {t("Reset demo data")}
          </Button>
        </Card>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Reset demo data?")}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{t("Cancel")}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDemo(user.id);
                setConfirm(false);
                toast("Demo data was reset.");
              }}
            >
              {t("Reset")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t("Uploads, edits and share links you made are removed and the original synthetic data is restored.")}</p>
      </Modal>
    </>
  );
}
