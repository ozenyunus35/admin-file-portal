import { randomId, shareToken } from "./ids";
import type { Activity, ActivityAction, Company, DemoState, FileItem, Folder, Project, ProjectStatus, ShareLink, User, UserStatus } from "./types";

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

/** The acting user as the state knows them now: a session can outlive a disable or a paused client. */
function requireActive(state: DemoState, actor: User): User {
  const current = state.users.find((u) => u.id === actor.id);
  if (!current || current.status === "disabled") throw new ApiError(403, "This account is disabled.");
  if (current.role === "client" && state.companies.find((c) => c.id === current.companyId)?.status === "paused") throw new ApiError(403, "This client's portal is paused.");
  return current;
}

function requireAdmin(state: DemoState, actor: User) {
  if (requireActive(state, actor).role !== "admin") throw new ApiError(403, "Only admins can do this.");
}

function requireCompanyAccess(state: DemoState, actor: User, companyId: string) {
  const current = requireActive(state, actor);
  if (current.role !== "admin" && current.companyId !== companyId) throw new ApiError(403, "You don't have access to this client.");
}

/** Whether a user may sign in: not disabled, and their client is not paused. */
export function canSignIn(state: DemoState, user: User): boolean {
  if (user.status === "disabled") return false;
  return user.role === "admin" || state.companies.find((c) => c.id === user.companyId)?.status !== "paused";
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

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const MAX_NAME = 80;

export interface UserInput {
  name: string;
  email: string;
  role: User["role"];
  title: string;
  companyId: string | null;
}

function validateUser(state: DemoState, input: UserInput, ignoreId?: string) {
  if (input.name.trim().length < 2) throw new ApiError(400, "Name must be at least 2 characters.");
  if (input.name.trim().length > MAX_NAME) throw new ApiError(400, `Name can be at most ${MAX_NAME} characters.`);
  if (input.title.trim().length > MAX_NAME) throw new ApiError(400, `Title can be at most ${MAX_NAME} characters.`);
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ApiError(400, "Enter a valid email address.");
  if (input.role !== "admin" && input.role !== "client") throw new ApiError(400, "Unknown role.");
  if (state.users.some((u) => u.id !== ignoreId && u.email.toLowerCase() === email)) throw new ApiError(409, "A user with this email already exists.");
  if (input.role === "client" && !input.companyId) throw new ApiError(400, "Client users must belong to a company.");
  if (input.companyId && !state.companies.some((c) => c.id === input.companyId)) throw new ApiError(404, "Company not found.");
}

export function createUser(state: DemoState, actor: User, input: UserInput): DemoState {
  requireAdmin(state, actor);
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
  requireAdmin(state, actor);
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
  requireAdmin(state, actor);
  const user = find(state.users, id, "User");
  if (user.id === actor.id && status === "disabled") throw new ApiError(400, "You can't disable your own account.");
  const next = { ...state, users: state.users.map((u) => (u.id === id ? { ...u, status } : u)) };
  return log(next, actor, status === "disabled" ? "user.disable" : "user.enable", user.name, user.companyId);
}

const COMPANY_STATUSES: Company["status"][] = ["active", "onboarding", "paused"];
const PLANS: Company["plan"][] = ["Starter", "Growth", "Enterprise"];

export function updateCompany(state: DemoState, actor: User, id: string, patch: Partial<Pick<Company, "status" | "plan" | "quota">>): DemoState {
  requireAdmin(state, actor);
  const company = find(state.companies, id, "Company");
  if (patch.status != null && !COMPANY_STATUSES.includes(patch.status)) throw new ApiError(400, "Unknown client status.");
  if (patch.plan != null && !PLANS.includes(patch.plan)) throw new ApiError(400, "Unknown plan.");
  if (patch.quota != null) {
    if (!Number.isSafeInteger(patch.quota) || patch.quota <= 0) throw new ApiError(400, "Quota must be a positive number of bytes.");
    const used = storageUsed(state, id);
    if (used > patch.quota) throw new ApiError(409, `${company.name} already uses more storage than that plan allows. Delete files first.`);
  }
  const next = { ...state, companies: state.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
  return log(next, actor, "company.update", company.name, company.id);
}

const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "review", "completed", "on-hold"];

export function updateProject(state: DemoState, actor: User, id: string, patch: Partial<Pick<Project, "status" | "progress" | "ownerId" | "dueDate">>): DemoState {
  requireAdmin(state, actor);
  const project = find(state.projects, id, "Project");
  if (patch.progress != null && (!Number.isInteger(patch.progress) || patch.progress < 0 || patch.progress > 100)) throw new ApiError(400, "Progress must be a whole number between 0 and 100.");
  if (patch.status != null && !PROJECT_STATUSES.includes(patch.status)) throw new ApiError(400, "Unknown project status.");
  if (patch.ownerId != null && patch.ownerId !== project.ownerId) {
    const owner = state.users.find((u) => u.id === patch.ownerId);
    if (!owner) throw new ApiError(404, "Owner not found.");
    if (owner.role !== "admin" || owner.status === "disabled") throw new ApiError(400, "The owner must be an active team member.");
  }
  if (patch.dueDate != null) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(patch.dueDate) || Number.isNaN(Date.parse(patch.dueDate))) throw new ApiError(400, "Enter a valid due date.");
    if (patch.dueDate.slice(0, 10) < project.startDate.slice(0, 10)) throw new ApiError(400, "The due date can't be before the start date.");
  }
  const merged = { ...project, ...patch };
  if (merged.status === "completed" && merged.progress !== 100) throw new ApiError(400, "A completed project must be at 100%.");
  const next = { ...state, projects: state.projects.map((p) => (p.id === id ? merged : p)) };
  return log(next, actor, "project.update", project.name, project.companyId);
}

export function createFolder(state: DemoState, actor: User, companyId: string, name: string): { state: DemoState; folder: Folder } {
  requireCompanyAccess(state, actor, companyId);
  const clean = name.trim();
  if (!clean) throw new ApiError(400, "Folder name can't be empty.");
  if (clean.length > 60) throw new ApiError(400, "Folder name is too long.");
  if (/[\\/]/.test(clean)) throw new ApiError(400, "Folder names can't contain slashes.");
  if (/[\p{Cc}]/u.test(clean) || /^\.+$/.test(clean)) throw new ApiError(400, "Enter a folder name with letters or numbers.");
  if (state.folders.some((f) => f.companyId === companyId && f.name.toLowerCase() === clean.toLowerCase())) throw new ApiError(409, "A folder with this name already exists.");
  const folder: Folder = { id: randomId("f"), companyId, name: clean };
  return { state: log({ ...state, folders: [...state.folders, folder] }, actor, "folder.create", clean, companyId), folder };
}

/** Checks an upload before any bytes move, so the UI can fail fast. */
export function checkUpload(state: DemoState, actor: User, folderId: string, size: number, pendingBytes = 0): Folder {
  const folder = find(state.folders, folderId, "Folder");
  requireCompanyAccess(state, actor, folder.companyId);
  if (!Number.isSafeInteger(size) || size < 0) throw new ApiError(400, "This file has an invalid size.");
  if (size === 0) throw new ApiError(400, "This file is empty.");
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(413, "This file is larger than 25 MB, the limit in this demo.");
  const company = find(state.companies, folder.companyId, "Company");
  if (storageUsed(state, company.id) + pendingBytes + size > company.quota) throw new ApiError(413, "Storage quota exceeded for this client.");
  return folder;
}

export const MAX_FILE_NAME = 180;

/**
 * A file name safe to store and show: no path, no control or bidi-override characters,
 * at most MAX_FILE_NAME characters with the extension kept. Null when nothing is left.
 */
export function cleanFileName(name: string): string | null {
  let n = name.normalize("NFC").replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, "").split(/[\\/]/).pop()!.replace(/\s+/g, " ").trim();
  if (!n || /^\.+$/.test(n)) return null;
  if (n.length > MAX_FILE_NAME) {
    const ext = n.match(/(\.[\w-]{1,10}){1,2}$/)?.[0] ?? "";
    n = n.slice(0, MAX_FILE_NAME - ext.length).trimEnd() + ext;
  }
  return n;
}

export function addFile(state: DemoState, actor: User, input: { id: string; folderId: string; name: string; mime: string; size: number }): DemoState {
  const folder = checkUpload(state, actor, input.folderId, input.size);
  const name = cleanFileName(input.name);
  if (!name) throw new ApiError(400, "This file has no usable name.");
  if (state.files.some((f) => f.id === input.id)) throw new ApiError(409, "A file with this id already exists.");
  const file: FileItem = {
    id: input.id,
    companyId: folder.companyId,
    folderId: folder.id,
    name,
    mime: input.mime || "application/octet-stream",
    size: input.size,
    uploadedBy: actor.id,
    createdAt: now(),
  };
  return log({ ...state, files: [file, ...state.files] }, actor, "file.upload", file.name, file.companyId);
}

export function deleteFile(state: DemoState, actor: User, id: string): DemoState {
  const file = find(state.files, id, "File");
  requireCompanyAccess(state, actor, file.companyId);
  if (!canDeleteFile(actor, file)) throw new ApiError(403, "You can only delete files you uploaded.");
  const next = { ...state, files: state.files.filter((f) => f.id !== id), shares: state.shares.filter((s) => s.fileId !== id) };
  return log(next, actor, "file.delete", file.name, file.companyId);
}

export function recordDownload(state: DemoState, actor: User, id: string): DemoState {
  const file = find(state.files, id, "File");
  requireCompanyAccess(state, actor, file.companyId);
  return log(state, actor, "file.download", file.name, file.companyId);
}

export function createShare(state: DemoState, actor: User, fileId: string, days: number): { state: DemoState; share: ShareLink } {
  const file = find(state.files, fileId, "File");
  requireCompanyAccess(state, actor, file.companyId);
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
  if (Date.parse(share.expiresAt) <= at) return { error: "This link has expired." };
  const file = state.files.find((f) => f.id === share.fileId);
  if (!file) return { error: "The shared file was deleted." };
  // A link speaks for the person who made it; it stops when they lose access.
  const creator = state.users.find((u) => u.id === share.createdBy);
  if (!creator || !canSignIn(state, creator)) return { error: "This link is no longer available." };
  if (state.companies.find((c) => c.id === file.companyId)?.status === "paused") return { error: "This link is no longer available." };
  return { share, file };
}

/** A download through a share link: counted on the link and written to the activity log. */
export function recordShareDownload(state: DemoState, token: string, at = Date.now()): DemoState {
  const res = resolveShare(state, token, at);
  if ("error" in res) throw new ApiError(404, res.error);
  const creator = state.users.find((u) => u.id === res.share.createdBy)!;
  const next = { ...state, shares: state.shares.map((s) => (s.id === res.share.id ? { ...s, downloads: s.downloads + 1 } : s)) };
  return log(next, creator, "share.download", res.file.name, res.file.companyId);
}

export function canRevokeShare(actor: User, share: ShareLink): boolean {
  return actor.role === "admin" || share.createdBy === actor.id;
}

export function revokeShare(state: DemoState, actor: User, shareId: string): DemoState {
  const share = find(state.shares, shareId, "Share link");
  const file = find(state.files, share.fileId, "File");
  requireCompanyAccess(state, actor, file.companyId);
  if (!canRevokeShare(actor, share)) throw new ApiError(403, "You can only revoke links you created.");
  return log({ ...state, shares: state.shares.filter((s) => s.id !== shareId) }, actor, "share.revoke", file.name, file.companyId);
}

/** "Report.pdf" -> "Report (1).pdf" when the folder already has that name. */
export function uniqueName(state: DemoState, folderId: string, name: string): string {
  const taken = new Set(state.files.filter((f) => f.folderId === folderId).map((f) => f.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  // ".tar.gz" stays together, and "Report (1).pdf" becomes "Report (2).pdf", not "Report (1) (1).pdf".
  const ext = name.match(/(?<=.)(\.tar)?\.[^.\s]{1,10}$/i)?.[0] ?? "";
  const stem = name.slice(0, name.length - ext.length).replace(/ \(\d+\)$/, "");
  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function canDeleteFile(actor: User, file: FileItem): boolean {
  return actor.role === "admin" || (actor.companyId === file.companyId && file.uploadedBy === actor.id);
}
