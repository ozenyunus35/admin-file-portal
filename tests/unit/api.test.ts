import { describe, expect, it } from "vitest";
import { ApiError, addFile, canDeleteFile, checkUpload, createFolder, createShare, createUser, deleteFile, resolveShare, setUserStatus, storageUsed, uniqueName, updateProject, updateUser } from "@/lib/api";
import { DEMO_ADMIN_ID, DEMO_CLIENT_ID, createSeed } from "@/lib/seed";

const fresh = () => createSeed(new Date("2026-10-28T12:00:00Z"));
const admin = (s = fresh()) => s.users.find((u) => u.id === DEMO_ADMIN_ID)!;
const client = (s = fresh()) => s.users.find((u) => u.id === DEMO_CLIENT_ID)!;

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(status);
    return;
  }
  throw new Error("expected an ApiError");
}

describe("users", () => {
  it("lets admins invite users and logs it", () => {
    const s = fresh();
    const next = createUser(s, admin(s), { name: "Test Person", email: "Test@Acme.example", role: "client", title: "QA", companyId: s.companies[1].id });
    const created = next.users[0];
    expect(created).toMatchObject({ email: "test@acme.example", status: "invited", companyId: s.companies[1].id });
    expect(next.activity[0]).toMatchObject({ action: "user.create", actorId: DEMO_ADMIN_ID });
    expect(s.users).toHaveLength(next.users.length - 1); // input state untouched
  });

  it("rejects clients, duplicate emails and invalid input", () => {
    const s = fresh();
    const input = { name: "X Y", email: "new@x.example", role: "client" as const, title: "", companyId: s.companies[0].id };
    expectApiError(() => createUser(s, client(s), input), 403);
    expectApiError(() => createUser(s, admin(s), { ...input, email: s.users[3].email.toUpperCase() }), 409);
    expectApiError(() => createUser(s, admin(s), { ...input, email: "not-an-email" }), 400);
    expectApiError(() => createUser(s, admin(s), { ...input, companyId: null }), 400);
  });

  it("does not let admins lock themselves out", () => {
    const s = fresh();
    const me = admin(s);
    expectApiError(() => setUserStatus(s, me, me.id, "disabled"), 400);
    expectApiError(() => updateUser(s, me, me.id, { name: me.name, email: me.email, role: "client", title: "", companyId: s.companies[0].id }), 400);
  });

  it("disables and re-enables users", () => {
    const s = fresh();
    const target = client(s);
    const off = setUserStatus(s, admin(s), target.id, "disabled");
    expect(off.users.find((u) => u.id === target.id)!.status).toBe("disabled");
    const on = setUserStatus(off, admin(off), target.id, "active");
    expect(on.users.find((u) => u.id === target.id)!.status).toBe("active");
    expect(on.activity.slice(0, 2).map((a) => a.action)).toEqual(["user.enable", "user.disable"]);
  });
});

describe("files", () => {
  it("scopes clients to their own company", () => {
    const s = fresh();
    const other = s.folders.find((f) => f.companyId !== client(s).companyId)!;
    expectApiError(() => checkUpload(s, client(s), other.id, 100), 403);
    expectApiError(() => createFolder(s, client(s), other.companyId, "Hacks"), 403);
  });

  it("enforces the per-file limit and the storage quota", () => {
    const s = fresh();
    const folder = s.folders.find((f) => f.companyId === client(s).companyId)!;
    expectApiError(() => checkUpload(s, client(s), folder.id, 26 * 1024 ** 2), 413);
    const company = s.companies.find((c) => c.id === folder.companyId)!;
    const room = company.quota - storageUsed(s, company.id);
    expect(() => checkUpload(s, client(s), folder.id, 1024)).not.toThrow();
    expectApiError(() => checkUpload(s, client(s), folder.id, 1024, room), 413);
  });

  it("adds files and lets clients delete only their own uploads", () => {
    let s = fresh();
    const me = client(s);
    const folder = s.folders.find((f) => f.companyId === me.companyId)!;
    s = addFile(s, me, { id: "file-new", folderId: folder.id, name: "notes.txt", mime: "text/plain", size: 10 });
    const mine = s.files.find((f) => f.id === "file-new")!;
    expect(mine).toMatchObject({ companyId: me.companyId, uploadedBy: me.id });
    const notMine = s.files.find((f) => f.companyId === me.companyId && f.uploadedBy !== me.id)!;
    expect(canDeleteFile(me, mine)).toBe(true);
    expect(canDeleteFile(me, notMine)).toBe(false);
    expectApiError(() => deleteFile(s, me, notMine.id), 403);
    expect(deleteFile(s, me, mine.id).files.some((f) => f.id === mine.id)).toBe(false);
  });

  it("validates folder names", () => {
    const s = fresh();
    const cid = client(s).companyId!;
    expectApiError(() => createFolder(s, client(s), cid, "   "), 400);
    expectApiError(() => createFolder(s, client(s), cid, "a/b"), 400);
    expectApiError(() => createFolder(s, client(s), cid, "contracts"), 409);
    const { state, folder } = createFolder(s, client(s), cid, " Briefs ");
    expect(folder.name).toBe("Briefs");
    expect(state.folders).toContainEqual(folder);
  });

  it("de-duplicates names inside a folder", () => {
    const s = fresh();
    const file = s.files[0];
    expect(uniqueName(s, file.folderId, "brand-new.pdf")).toBe("brand-new.pdf");
    const dup = uniqueName(s, file.folderId, file.name.toUpperCase());
    expect(dup).toMatch(/ \(1\)(\.[^.]+)?$/);
  });
});

describe("share links", () => {
  it("creates, resolves and expires links", () => {
    const s = fresh();
    const file = s.files.find((f) => f.companyId === client(s).companyId)!;
    const { state, share } = createShare(s, client(s), file.id, 7);
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const ok = resolveShare(state, share.token);
    expect("file" in ok && ok.file.id).toBe(file.id);
    expect(resolveShare(state, share.token, Date.parse(share.expiresAt) + 1)).toEqual({ error: "This link has expired." });
    expect(resolveShare(state, "nope")).toHaveProperty("error");
    expect(resolveShare(deleteFile(state, admin(state), file.id), share.token)).toHaveProperty("error");
  });

  it("only allows the supported expiry options", () => {
    const s = fresh();
    expectApiError(() => createShare(s, admin(s), s.files[0].id, 3), 400);
  });
});

describe("projects", () => {
  it("is admin-only and validates progress", () => {
    const s = fresh();
    const p = s.projects[0];
    expectApiError(() => updateProject(s, client(s), p.id, { progress: 50 }), 403);
    expectApiError(() => updateProject(s, admin(s), p.id, { progress: 120 }), 400);
    expect(updateProject(s, admin(s), p.id, { status: "completed", progress: 100 }).projects[0]).toMatchObject({ status: "completed", progress: 100 });
  });
});
