import { randomId, shareToken } from "./ids";
import type { Activity, ActivityAction, Company, DemoState, FileItem, Folder, Project, ShareLink, User, UserStatus } from "./types";

/**
 * The mock backend. Each function takes the current state and the acting user,
 * checks permissions like a real API would, and returns a new state. In a real
 * deployment these map one-to-one to API routes (see README).
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 ** 2;
export const QUOTA_WARNING = 0.85;

export class ApiError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 413,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

function requireAdmin(actor: User) {
  if (actor.role !== "admin") throw new ApiError(403, "Only admins can do this.");
}

function requireCompanyAccess(actor: User, companyId: string) {
  if (actor.role !== "admin" && actor.companyId !== companyId) throw new ApiError(403, "You don't have access to this client.");
}

function find<T extends { id: string }>(list: T[], id: string, what: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError(404, `${what} not found.`);
  return item;
}

export function log(state: DemoState, actor: User, action: ActivityAction, target: string, companyId: string | null): DemoState {
  const entry: Activity = { id: randomId("a"), at: now(), actorId: actor.id, action, target, companyId };
  return { ...state, activity: [entry, ...state.activity].slice(0, 1000) };
}

export function visibleCompanies(state: DemoState, actor: User): Company[] {
  return actor.role === "admin" ? state.companies : state.companies.filter((c) => c.id === actor.companyId);
}

export function storageUsed(state: DemoState, companyId: string): number {
  return state.files.reduce((sum, f) => (f.companyId === companyId ? sum + f.size : sum), 0);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserInput {
  name: string;
  email: string;
  role: User["role"];
  title: string;
  companyId: string | null;
}

function validateUser(state: DemoState, input: UserInput, ignoreId?: string) {
  if (input.name.trim().length < 2) throw new ApiError(400, "Name must be at least 2 characters.");
  if (!EMAIL_RE.test(input.email)) throw new ApiError(400, "Enter a valid email address.");
  const email = input.email.trim().toLowerCase();
  if (state.users.some((u) => u.id !== ignoreId && u.email.toLowerCase() === email)) throw new ApiError(409, "A user with this email already exists.");
  if (input.role === "client" && !input.companyId) throw new ApiError(400, "Client users must belong to a company.");
  if (input.companyId && !state.companies.some((c) => c.id === input.companyId)) throw new ApiError(404, "Company not found.");
}

export function createUser(state: DemoState, actor: User, input: UserInput): DemoState {
  requireAdmin(actor);
  validateUser(state, input);
  const user: User = {
    id: randomId("u"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    title: input.title.trim(),
    companyId: input.role === "admin" ? null : input.companyId,
    status: "invited",
    createdAt: now(),
    lastActiveAt: null,
  };
  return log({ ...state, users: [user, ...state.users] }, actor, "user.create", user.name, user.companyId);
}

export function updateUser(state: DemoState, actor: User, id: string, input: UserInput): DemoState {
  requireAdmin(actor);
  const existing = find(state.users, id, "User");
  validateUser(state, input, id);
  if (existing.id === actor.id && input.role !== "admin") throw new ApiError(400, "You can't remove your own admin role.");
  const user: User = {
    ...existing,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    title: input.title.trim(),
    companyId: input.role === "admin" ? null : input.companyId,
  };
  return log({ ...state, users: state.users.map((u) => (u.id === id ? user : u)) }, actor, "user.update", user.name, user.companyId);
}

export function setUserStatus(state: DemoState, actor: User, id: string, status: UserStatus): DemoState {
  requireAdmin(actor);
  const user = find(state.users, id, "User");
  if (user.id === actor.id && status === "disabled") throw new ApiError(400, "You can't disable your own account.");
  const next = { ...state, users: state.users.map((u) => (u.id === id ? { ...u, status } : u)) };
  return log(next, actor, status === "disabled" ? "user.disable" : "user.enable", user.name, user.companyId);
}

export function updateCompany(state: DemoState, actor: User, id: string, patch: Partial<Pick<Company, "status" | "plan" | "quota">>): DemoState {
  requireAdmin(actor);
  const company = find(state.companies, id, "Company");
  const next = { ...state, companies: state.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
  return log(next, actor, "company.update", company.name, company.id);
}

export function updateProject(state: DemoState, actor: User, id: string, patch: Partial<Pick<Project, "status" | "progress" | "ownerId" | "dueDate">>): DemoState {
  requireAdmin(actor);
  const project = find(state.projects, id, "Project");
  if (patch.progress != null && (patch.progress < 0 || patch.progress > 100)) throw new ApiError(400, "Progress must be between 0 and 100.");
  const next = { ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
  return log(next, actor, "project.update", project.name, project.companyId);
}

export function createFolder(state: DemoState, actor: User, companyId: string, name: string): { state: DemoState; folder: Folder } {
  requireCompanyAccess(actor, companyId);
  const clean = name.trim();
  if (!clean) throw new ApiError(400, "Folder name can't be empty.");
  if (clean.length > 60) throw new ApiError(400, "Folder name is too long.");
  if (/[\\/]/.test(clean)) throw new ApiError(400, "Folder names can't contain slashes.");
  if (state.folders.some((f) => f.companyId === companyId && f.name.toLowerCase() === clean.toLowerCase())) throw new ApiError(409, "A folder with this name already exists.");
  const folder: Folder = { id: randomId("f"), companyId, name: clean };
  return { state: log({ ...state, folders: [...state.folders, folder] }, actor, "folder.create", clean, companyId), folder };
}

/** Checks an upload before any bytes move, so the UI can fail fast. */
export function checkUpload(state: DemoState, actor: User, folderId: string, size: number, pendingBytes = 0): Folder {
  const folder = find(state.folders, folderId, "Folder");
  requireCompanyAccess(actor, folder.companyId);
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(413, "Files are limited to 25 MB in this demo.");
  const company = find(state.companies, folder.companyId, "Company");
  if (storageUsed(state, company.id) + pendingBytes + size > company.quota) throw new ApiError(413, "Storage quota exceeded for this client.");
  return folder;
}

export function addFile(state: DemoState, actor: User, input: { id: string; folderId: string; name: string; mime: string; size: number }): DemoState {
  const folder = checkUpload(state, actor, input.folderId, input.size);
  const file: FileItem = {
    id: input.id,
    companyId: folder.companyId,
    folderId: folder.id,
    name: input.name,
    mime: input.mime || "application/octet-stream",
    size: input.size,
    uploadedBy: actor.id,
    createdAt: now(),
  };
  return log({ ...state, files: [file, ...state.files] }, actor, "file.upload", file.name, file.companyId);
}

export function deleteFile(state: DemoState, actor: User, id: string): DemoState {
  const file = find(state.files, id, "File");
  requireCompanyAccess(actor, file.companyId);
  if (!canDeleteFile(actor, file)) throw new ApiError(403, "You can only delete files you uploaded.");
  const next = { ...state, files: state.files.filter((f) => f.id !== id), shares: state.shares.filter((s) => s.fileId !== id) };
  return log(next, actor, "file.delete", file.name, file.companyId);
}

export function recordDownload(state: DemoState, actor: User, id: string): DemoState {
  const file = find(state.files, id, "File");
  requireCompanyAccess(actor, file.companyId);
  return log(state, actor, "file.download", file.name, file.companyId);
}

export function createShare(state: DemoState, actor: User, fileId: string, days: number): { state: DemoState; share: ShareLink } {
  const file = find(state.files, fileId, "File");
  requireCompanyAccess(actor, file.companyId);
  if (![1, 7, 30].includes(days)) throw new ApiError(400, "Links can expire after 1, 7 or 30 days.");
  const created = Date.now();
  const share: ShareLink = {
    id: randomId("s"),
    token: shareToken(),
    fileId,
    createdBy: actor.id,
    createdAt: new Date(created).toISOString(),
    expiresAt: new Date(created + days * 86_400_000).toISOString(),
    downloads: 0,
  };
  return { state: log({ ...state, shares: [share, ...state.shares] }, actor, "file.share", file.name, file.companyId), share };
}

export function resolveShare(state: DemoState, token: string, at = Date.now()): { share: ShareLink; file: FileItem } | { error: string } {
  const share = state.shares.find((s) => s.token === token);
  if (!share) return { error: "This link doesn't exist or was revoked." };
  if (Date.parse(share.expiresAt) < at) return { error: "This link has expired." };
  const file = state.files.find((f) => f.id === share.fileId);
  if (!file) return { error: "The shared file was deleted." };
  return { share, file };
}

export function revokeShare(state: DemoState, actor: User, shareId: string): DemoState {
  const share = find(state.shares, shareId, "Share link");
  const file = find(state.files, share.fileId, "File");
  requireCompanyAccess(actor, file.companyId);
  return { ...state, shares: state.shares.filter((s) => s.id !== shareId) };
}

/** "Report.pdf" -> "Report (1).pdf" when the folder already has that name. */
export function uniqueName(state: DemoState, folderId: string, name: string): string {
  const taken = new Set(state.files.filter((f) => f.folderId === folderId).map((f) => f.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function canDeleteFile(actor: User, file: FileItem): boolean {
  return actor.role === "admin" || (actor.companyId === file.companyId && file.uploadedBy === actor.id);
}
