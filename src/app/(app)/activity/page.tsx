"use client";

import { Activity as ActivityIcon, Download } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ACTION_LABEL, actorName } from "@/components/activity-text";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, EmptyState, PageHeader, type Tone } from "@/components/ui";
import { log } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { mutate, useStore } from "@/lib/store";
import type { ActivityAction } from "@/lib/types";

const GROUP_TONE: Record<string, Tone> = { auth: "neutral", user: "info", company: "info", project: "warning", file: "accent", folder: "accent", export: "success", demo: "danger" };

export default function ActivityPage() {
  const { state, user } = useStore();
  const { toast } = useToast();
  if (!state || !user) return null;

  const rows = state.activity.map((a) => ({
    ...a,
    actor: actorName(state, a.actorId),
    company: state.companies.find((c) => c.id === a.companyId)?.name ?? "Atlas team",
    event: ACTION_LABEL[a.action],
  }));
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "at", header: "Time", sortable: true, render: (a) => <time dateTime={a.at} className="whitespace-nowrap text-muted">{formatDateTime(a.at)}</time> },
    { key: "actor", header: "User", sortable: true, render: (a) => <span className="font-medium">{a.actor}</span> },
    { key: "action", header: "Event", sortable: true, render: (a) => <Badge tone={GROUP_TONE[a.action.split(".")[0]]}>{a.action}</Badge> },
    { key: "target", header: "Target", hideOnMobile: true, render: (a) => <span className="break-all">{a.target}</span> },
    { key: "company", header: "Client", sortable: true, hideOnMobile: true, render: (a) => <span className="text-muted">{a.company}</span> },
  ];

  const actions = Object.keys(ACTION_LABEL) as ActivityAction[];

  return (
    <>
      <PageHeader title="Activity log" description="Audit trail of sign-ins, edits, uploads, downloads and shares." />
      <Card>
        <DataTable
          label="Activity log"
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          searchKeys={["actor", "target", "company"]}
          searchPlaceholder="Search user, target or client"
          filters={[
            { key: "action", label: "Event", options: actions.map((a) => ({ value: a, label: a })) },
            { key: "companyId", label: "Client", options: state.companies.map((c) => ({ value: c.id, label: c.name })) },
          ]}
          initialSort={{ key: "at", dir: "desc" }}
          pageSize={15}
          toolbar={(visible) => (
            <Button
              size="sm"
              disabled={visible.length === 0}
              onClick={() => {
                downloadCsv(
                  toCsv(visible, [
                    { header: "Time (UTC)", value: (a) => a.at },
                    { header: "User", value: (a) => a.actor },
                    { header: "Event", value: (a) => a.action },
                    { header: "Target", value: (a) => a.target },
                    { header: "Client", value: (a) => a.company },
                  ]),
                  `activity-${new Date().toISOString().slice(0, 10)}.csv`,
                );
                mutate((s) => log(s, user, "export.csv", `${visible.length} activity entries`, null));
                toast(`Exported ${visible.length} entries to CSV.`);
              }}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          )}
          empty={<EmptyState icon={ActivityIcon} title="No activity matches" text="Try a different search or clear the filters." />}
        />
      </Card>
    </>
  );
}
