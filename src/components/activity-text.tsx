import type { Activity, ActivityAction, DemoState } from "@/lib/types";

export const ACTION_LABEL: Record<ActivityAction, string> = {
  "auth.login": "signed in",
  "user.create": "invited",
  "user.update": "updated user",
  "user.disable": "disabled",
  "user.enable": "re-enabled",
  "company.update": "updated client",
  "project.update": "updated project",
  "file.upload": "uploaded",
  "file.download": "downloaded",
  "file.delete": "deleted",
  "file.share": "created a share link for",
  "folder.create": "created folder",
  "export.csv": "exported",
  "demo.reset": "reset the demo",
};

export function actorName(state: DemoState, id: string) {
  return state.users.find((u) => u.id === id)?.name ?? "Deleted user";
}

export function ActivityText({ state, activity: a }: { state: DemoState; activity: Activity }) {
  return (
    <p className="min-w-0">
      <span className="font-medium">{actorName(state, a.actorId)}</span> <span className="text-muted">{ACTION_LABEL[a.action]}</span>{" "}
      {a.action !== "auth.login" && <span className="break-words">{a.target}</span>}
    </p>
  );
}
