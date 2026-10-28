export type Role = "admin" | "client";
export type UserStatus = "active" | "invited" | "disabled";
export type CompanyStatus = "active" | "onboarding" | "paused";
export type ProjectStatus = "planning" | "active" | "review" | "completed" | "on-hold";

export interface Company {
  id: string;
  name: string;
  industry: string;
  country: string;
  status: CompanyStatus;
  plan: "Starter" | "Growth" | "Enterprise";
  /** Storage quota in bytes. */
  quota: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Team title for admins, job title at the client company for clients. */
  title: string;
  companyId: string | null;
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  companyId: string;
  ownerId: string;
  status: ProjectStatus;
  budget: number;
  /** 0 to 100. */
  progress: number;
  startDate: string;
  dueDate: string;
}

export interface Folder {
  id: string;
  companyId: string;
  name: string;
}

/** Seeded files have no stored blob; their content is generated on demand from `seed`. */
export type SeedKind = "pdf" | "image" | "csv" | "text" | "archive";

export interface FileItem {
  id: string;
  companyId: string;
  folderId: string;
  name: string;
  mime: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  seed?: SeedKind;
}

export interface ShareLink {
  id: string;
  token: string;
  fileId: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  downloads: number;
}

export type ActivityAction =
  | "auth.login"
  | "user.create"
  | "user.update"
  | "user.disable"
  | "user.enable"
  | "company.update"
  | "project.update"
  | "file.upload"
  | "file.download"
  | "file.delete"
  | "file.share"
  | "folder.create"
  | "export.csv"
  | "demo.reset";

export interface Activity {
  id: string;
  at: string;
  actorId: string;
  action: ActivityAction;
  /** Human-readable target, e.g. a file or user name. */
  target: string;
  companyId: string | null;
}

export interface DemoState {
  version: number;
  seededAt: string;
  companies: Company[];
  users: User[];
  projects: Project[];
  folders: Folder[];
  files: FileItem[];
  shares: ShareLink[];
  activity: Activity[];
}
