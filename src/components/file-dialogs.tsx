"use client";

import { Check, Copy, Download, ExternalLink, File, FileArchive, FileImage, FileSpreadsheet, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createShare, recordDownload, revokeShare } from "@/lib/api";
import { getBlob } from "@/lib/blobs";
import { previewKind, seedBlob } from "@/lib/content";
import { downloadBlob } from "@/lib/csv";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { getState, mutate, setState } from "@/lib/store";
import type { DemoState, FileItem, User } from "@/lib/types";
import { PdfPreview } from "./pdf-preview";
import { useToast } from "./toast";
import { Button, EmptyState, Field, Modal, inputClass } from "./ui";

export function FileIcon({ file, className = "size-5" }: { file: Pick<FileItem, "mime" | "name">; className?: string }) {
  const kind = previewKind(file.mime, file.name);
  if (kind === "image") return <FileImage className={`${className} text-info`} aria-hidden />;
  if (kind === "pdf") return <FileText className={`${className} text-danger`} aria-hidden />;
  if (/csv|spreadsheet|excel/.test(file.mime) || /\.(csv|xlsx?)$/i.test(file.name)) return <FileSpreadsheet className={`${className} text-success`} aria-hidden />;
  if (/zip|compressed|tar/.test(file.mime)) return <FileArchive className={`${className} text-warning`} aria-hidden />;
  if (kind === "text") return <FileText className={`${className} text-muted`} aria-hidden />;
  return <File className={`${className} text-muted`} aria-hidden />;
}

/** Bytes for a file: stored upload from IndexedDB, or generated content for seeded files. */
export async function loadFileBlob(state: DemoState, file: FileItem): Promise<Blob | null> {
  if (file.seed) return seedBlob(file, state.companies.find((c) => c.id === file.companyId)!);
  return (await getBlob(file.id).catch(() => undefined)) ?? null;
}

export function useDownload(user: User | null) {
  const { toast } = useToast();
  return async (file: FileItem) => {
    if (!user) return;
    const blob = await loadFileBlob(getState(), file);
    if (!blob) return toast("The file content is missing from this browser's storage.", "error");
    downloadBlob(blob, file.name);
    mutate((s) => recordDownload(s, user, file.id));
  };
}

function parseCsv(text: string, maxRows = 50): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
    if (rows.length > maxRows) break;
  }
  return rows;
}

type Preview = { status: "loading" } | { status: "missing" } | { status: "ready"; url: string; blob: Blob; text?: string };
type Loaded = { fileId: string } & Preview;

export function PreviewDialog({ file, state, user, onClose }: { file: FileItem | null; state: DemoState; user: User; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const preview: Preview = loaded && loaded.fileId === file?.id ? loaded : { status: "loading" };
  const download = useDownload(user);

  useEffect(() => {
    if (!file) return;
    let url: string | null = null;
    let cancelled = false;
    loadFileBlob(state, file).then(async (blob) => {
      if (cancelled) return;
      if (!blob) return setLoaded({ fileId: file.id, status: "missing" });
      url = URL.createObjectURL(blob);
      const text = previewKind(file.mime, file.name) === "text" ? (await blob.slice(0, 64 * 1024).text()) : undefined;
      if (!cancelled) setLoaded({ fileId: file.id, status: "ready", url, blob, text });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // Regenerate only when a different file is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  const kind = file ? previewKind(file.mime, file.name) : "none";
  const uploader = state.users.find((u) => u.id === file?.uploadedBy)?.name ?? "Unknown";

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title={file?.name ?? ""}
      wide
      footer={
        file && (
          <>
            {preview.status === "ready" && (
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                <ExternalLink className="size-4" aria-hidden /> Open in new tab
              </a>
            )}
            <Button variant="primary" onClick={() => download(file)}>
              <Download className="size-4" /> Download
            </Button>
          </>
        )
      }
    >
      {file && (
        <>
          <p className="mb-3 text-xs text-muted">
            {formatBytes(file.size)} · uploaded by {uploader} · {formatDateTime(file.createdAt)}
            {file.seed && " · synthetic sample content"}
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
            {preview.status === "loading" && (
              <div className="flex h-72 items-center justify-center text-muted" role="status">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                <span className="sr-only">Loading preview</span>
              </div>
            )}
            {preview.status === "missing" && <EmptyState icon={File} title="File content not found" text="The bytes for this upload are no longer in this browser's storage. Delete the entry or upload it again." />}
            {preview.status === "ready" && kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={`Preview of ${file.name}`} className="mx-auto max-h-[60vh] w-auto object-contain" />
            )}
            {preview.status === "ready" && kind === "pdf" && (
              <PdfPreview blob={preview.blob} name={file.name} />
            )}
            {preview.status === "ready" && kind === "text" && preview.text !== undefined && (
              /\.csv$/i.test(file.name) || file.mime === "text/csv" ? (
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <tbody>
                      {parseCsv(preview.text).map((row, i) => (
                        <tr key={i} className={i === 0 ? "bg-surface font-semibold" : "border-t border-border"}>
                          {row.map((c, j) => (
                            <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="max-h-[60vh] overflow-auto p-4 font-mono text-xs whitespace-pre-wrap">{preview.text}</pre>
              )
            )}
            {preview.status === "ready" && kind === "none" && <EmptyState icon={File} title="No preview for this file type" text="Download the file to open it on your device." />}
          </div>
        </>
      )}
    </Modal>
  );
}

export function ShareDialog({ file, state, user, onClose }: { file: FileItem | null; state: DemoState; user: User; onClose: () => void }) {
  const { toast, run } = useToast();
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState<string | null>(null);
  const links = file ? state.shares.filter((s) => s.fileId === file.id) : [];
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  const urlFor = (token: string) => `${base}/share/#${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Couldn't copy. Select the link and copy it manually.", "error");
    }
  };

  return (
    <Modal open={!!file} onClose={onClose} title={file ? `Share ${file.name}` : ""}>
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted">Anyone with the link can download this file until it expires. In this demo, links only open in the same browser because data never leaves it.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Link expires after">
                {(id) => (
                  <select id={id} className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                  </select>
                )}
              </Field>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                const res = run(() => createShare(getState(), user, file.id, days));
                if (res) {
                  setState(res.state);
                  copy(res.share.token);
                  toast("Share link created.");
                }
              }}
            >
              <Link2 className="size-4" /> Create link
            </Button>
          </div>

          {links.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Active links</h3>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <input readOnly value={urlFor(l.token)} aria-label="Share link" className={`${inputClass} h-9 font-mono text-xs`} onFocus={(e) => e.target.select()} />
                      <button onClick={() => copy(l.token)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Copy link">
                        {copied === l.token ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                      </button>
                      <button onClick={() => run(() => mutate((s) => revokeShare(s, user, l.id)), "Link revoked.")} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Revoke link">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      Expires {formatDate(l.expiresAt)} · {l.downloads} download{l.downloads === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
