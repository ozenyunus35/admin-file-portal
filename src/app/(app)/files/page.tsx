"use client";

import { AlertCircle, CheckCircle2, Download, Eye, Folder, FolderOpen, FolderPlus, Link2, Trash2, UploadCloud, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { FileIcon, PreviewDialog, ShareDialog, useDownload } from "@/components/file-dialogs";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Field, Meter, Modal, PageHeader, Spinner, cx, inputClass } from "@/components/ui";
import { ApiError, MAX_UPLOAD_BYTES, addFile, canDeleteFile, checkUpload, createFolder, deleteFile, storageUsed, uniqueName } from "@/lib/api";
import { deleteBlob, putBlob } from "@/lib/blobs";
import { formatBytes, formatDateTime } from "@/lib/format";
import { randomId } from "@/lib/ids";
import { getState, mutate, setState, useStore } from "@/lib/store";
import type { DemoState, FileItem, User } from "@/lib/types";

interface UploadJob {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

/** Simulated network speed for the progress bar: 6 MB/s, between 0.6 and 4 seconds. */
const uploadDuration = (size: number) => Math.min(4000, Math.max(600, (size / (6 * 1024 ** 2)) * 1000));

function useUploads(user: User) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const pending = useRef(0);
  const patch = (key: string, p: Partial<UploadJob>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...p } : j)));

  const uploadOne = async (file: File, folderId: string) => {
    const key = randomId("job");
    const job: UploadJob = { key, name: file.name, size: file.size, progress: 0, status: "uploading" };
    try {
      checkUpload(getState(), user, folderId, file.size, pending.current);
    } catch (e) {
      setJobs((js) => [{ ...job, status: "error", error: e instanceof ApiError ? e.message : "Upload failed." }, ...js]);
      return;
    }
    setJobs((js) => [job, ...js]);
    pending.current += file.size;
    const id = randomId("file");
    try {
      const total = uploadDuration(file.size);
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const p = Math.min(95, ((performance.now() - started) / total) * 95);
          patch(key, { progress: p });
          if (p >= 95) resolve();
          else setTimeout(tick, 80);
        };
        tick();
      });
      await putBlob(id, file);
      const name = uniqueName(getState(), folderId, file.name);
      mutate((s) => addFile(s, user, { id, folderId, name, mime: file.type, size: file.size }));
      patch(key, { progress: 100, status: "done", name });
    } catch (e) {
      await deleteBlob(id).catch(() => undefined);
      patch(key, { status: "error", error: e instanceof ApiError ? e.message : "Couldn't save the file in this browser." });
    } finally {
      pending.current -= file.size;
    }
  };

  const upload = (files: FileList | File[], folderId: string) => Promise.all(Array.from(files).map((f) => uploadOne(f, folderId)));
  const clearFinished = () => setJobs((js) => js.filter((j) => j.status === "uploading"));
  return { jobs, upload, clearFinished };
}

function DropZone({ disabled, onFiles }: { disabled?: boolean; onFiles: (files: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      data-testid="dropzone"
      className={cx("flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", over ? "border-accent bg-accent-soft/40" : "border-border bg-surface")}
    >
      <UploadCloud className={cx("size-8", over ? "text-accent" : "text-muted")} aria-hidden />
      <p className="mt-2 text-sm font-medium">
        <span className="hidden sm:inline">Drag and drop files here, or </span>
        <button type="button" onClick={() => input.current?.click()} disabled={disabled} className="text-accent underline underline-offset-2 disabled:opacity-50">
          browse<span className="sm:hidden"> files to upload</span>
        </button>
      </p>
      <p className="mt-1 text-xs text-muted">Up to {MAX_UPLOAD_BYTES / 1024 ** 2} MB per file. Images, PDFs and text files get a preview.</p>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Upload files"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UploadQueue({ jobs, onClear }: { jobs: UploadJob[]; onClear: () => void }) {
  if (jobs.length === 0) return null;
  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-medium">Uploads</h2>
        {jobs.some((j) => j.status !== "uploading") && (
          <button onClick={onClear} className="text-xs text-muted hover:text-text">
            Clear finished
          </button>
        )}
      </div>
      <ul className="divide-y divide-border" aria-live="polite">
        {jobs.map((j) => (
          <li key={j.key} className="px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              {j.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Uploaded" />}
              {j.status === "error" && <AlertCircle className="size-4 shrink-0 text-danger" aria-label="Failed" />}
              <span className="min-w-0 flex-1 truncate">{j.name}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{j.status === "uploading" ? `${Math.round(j.progress)}%` : formatBytes(j.size)}</span>
            </div>
            {j.status === "uploading" && (
              <div role="progressbar" aria-label={`Uploading ${j.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(j.progress)} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${j.progress}%` }} />
              </div>
            )}
            {j.error && <p className="mt-1 text-xs text-danger">{j.error}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FilePortal({ state, user }: { state: DemoState; user: User }) {
  const params = useSearchParams();
  const router = useRouter();
  const { run } = useToast();
  const isAdmin = user.role === "admin";
  const requested = params.get("client");
  const companyId = isAdmin ? (state.companies.some((c) => c.id === requested) ? requested! : state.companies[0].id) : user.companyId!;
  const company = state.companies.find((c) => c.id === companyId)!;
  const folders = state.folders.filter((f) => f.companyId === companyId);

  const [folderSel, setFolderSel] = useState<string | null>(null);
  const folderId = folders.some((f) => f.id === folderSel) ? folderSel! : folders[0]?.id;
  const folder = folders.find((f) => f.id === folderId);

  const [previewing, setPreviewing] = useState<FileItem | null>(null);
  const [sharing, setSharing] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string>();
  const { jobs, upload, clearFinished } = useUploads(user);
  const download = useDownload(user);

  const used = storageUsed(state, companyId);
  const files = state.files.filter((f) => f.folderId === folderId);
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "Unknown";
  const rows = files.map((f) => ({ ...f, uploader: userName(f.uploadedBy) }));
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (f) => (
        <button onClick={() => setPreviewing(f)} className="flex max-w-full items-center gap-3 text-left hover:text-accent">
          <FileIcon file={f} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{f.name}</span>
            <span className="block text-xs text-muted md:hidden">
              {formatBytes(f.size)} · {formatDateTime(f.createdAt)}
            </span>
          </span>
        </button>
      ),
    },
    { key: "size", header: "Size", sortable: true, hideOnMobile: true, className: "whitespace-nowrap tabular-nums", render: (f) => formatBytes(f.size) },
    { key: "uploader", header: "Uploaded by", sortable: true, hideOnMobile: "xl", render: (f) => <span className="text-muted">{f.uploader}</span> },
    { key: "createdAt", header: "Date", sortable: true, hideOnMobile: true, render: (f) => <span className="whitespace-nowrap text-muted">{formatDateTime(f.createdAt)}</span> },
    {
      key: "id",
      header: "Actions",
      className: "text-right",
      render: (f) => (
        <div className="flex justify-end gap-0.5">
          <button onClick={() => setPreviewing(f)} className="hidden rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text sm:block" aria-label={`Preview ${f.name}`}>
            <Eye className="size-4" />
          </button>
          <button onClick={() => download(f)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={`Download ${f.name}`}>
            <Download className="size-4" />
          </button>
          <button onClick={() => setSharing(f)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={`Share ${f.name}`}>
            <Link2 className="size-4" />
          </button>
          {canDeleteFile(user, f) && (
            <button onClick={() => setDeleting(f)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger" aria-label={`Delete ${f.name}`}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const submitFolder = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = createFolder(getState(), user, companyId, newFolder ?? "");
      setState(res.state);
      setFolderSel(res.folder.id);
      setNewFolder(null);
    } catch (err) {
      setFolderError(err instanceof ApiError ? err.message : "Couldn't create the folder.");
    }
  };

  return (
    <>
      <PageHeader
        title="Files"
        description={isAdmin ? "Shared files for each client, organised in folders." : `Shared files for ${company.name}.`}
        actions={
          isAdmin && (
            <select
              aria-label="Client"
              value={companyId}
              onChange={(e) => {
                setFolderSel(null);
                router.replace(`/files?client=${e.target.value}`);
              }}
              className={cx(inputClass, "w-full sm:w-64")}
            >
              {state.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        }
      />

      <Card className="mb-6 p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Storage</span>
          <span className="text-muted tabular-nums" data-testid="storage-usage">
            {formatBytes(used)} of {formatBytes(company.quota)} used · {company.plan} plan
          </span>
        </div>
        <Meter value={used} max={company.quota} label={`${company.name} storage used`} />
        {used / company.quota >= 0.85 && <p className="mt-2 text-xs text-warning">Storage is almost full. Delete old files or upgrade the plan.</p>}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Folders" className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Folders</h2>
            <button onClick={() => (setNewFolder(""), setFolderError(undefined))} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text" aria-label="New folder">
              <FolderPlus className="size-4" />
            </button>
          </div>
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {folders.map((f) => {
              const count = state.files.filter((x) => x.folderId === f.id).length;
              const active = f.id === folderId;
              return (
                <li key={f.id} className="shrink-0">
                  <button
                    onClick={() => setFolderSel(f.id)}
                    aria-current={active ? "true" : undefined}
                    className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap", active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}
                  >
                    {active ? <FolderOpen className="size-4" aria-hidden /> : <Folder className="size-4" aria-hidden />}
                    <span className="flex-1 text-left">{f.name}</span>
                    <span className="text-xs tabular-nums opacity-70">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <DropZone disabled={!folderId} onFiles={(fl) => folderId && upload(fl, folderId)} />
          <UploadQueue jobs={jobs} onClear={clearFinished} />

          <Card className="mt-6">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-medium">{folder?.name ?? "No folder"}</h2>
            </div>
            <DataTable
              key={folderId}
              label={`Files in ${folder?.name}`}
              rows={rows}
              columns={columns}
              rowKey={(f) => f.id}
              searchKeys={["name", "uploader"]}
              searchPlaceholder="Search this folder"
              initialSort={{ key: "createdAt", dir: "desc" }}
              empty={
                files.length === 0 ? (
                  <EmptyState icon={UploadCloud} title="This folder is empty" text="Drop files above to upload them to this folder." />
                ) : (
                  <EmptyState icon={Folder} title="No files match" text="Try a different search." />
                )
              }
            />
          </Card>
        </div>
      </div>

      <PreviewDialog file={previewing} state={state} user={user} onClose={() => setPreviewing(null)} />
      <ShareDialog file={sharing} state={state} user={user} onClose={() => setSharing(null)} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete file?"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleting) return;
                const f = deleting;
                run(() => mutate((s) => deleteFile(s, user, f.id)), `${f.name} was deleted.`);
                if (!f.seed) deleteBlob(f.id).catch(() => undefined);
                setDeleting(null);
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <span className="font-medium text-text">{deleting?.name}</span> and its share links will be removed. This can&apos;t be undone (except by resetting the demo).
        </p>
      </Modal>

      <Modal open={newFolder !== null} onClose={() => setNewFolder(null)} title="New folder">
        <form onSubmit={submitFolder} noValidate className="space-y-4">
          <Field label="Folder name" error={folderError}>
            {(id, d) => (
              <input
                id={id}
                autoFocus
                className={inputClass}
                value={newFolder ?? ""}
                onChange={(e) => (setNewFolder(e.target.value), setFolderError(undefined))}
                aria-invalid={!!folderError}
                aria-describedby={d}
                maxLength={80}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setNewFolder(null)}>
              <X className="size-4" /> Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create folder
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function FilesPageInner() {
  const { state, user } = useStore();
  if (!state || !user) return null;
  return <FilePortal state={state} user={user} />;
}

export default function FilesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <FilesPageInner />
    </Suspense>
  );
}
