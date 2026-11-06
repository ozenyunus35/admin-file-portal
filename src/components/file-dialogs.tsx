"use client";

import { Check, Copy, Download, ExternalLink, File, FileArchive, FileImage, FileSpreadsheet, FileText, Link2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { canRevokeShare, createShare, recordDownload, revokeShare } from "@/lib/api";
import { getBlob } from "@/lib/blobs";
import { previewKind, seedBlob, type PreviewKind } from "@/lib/content";
import { LABEL, RASTER, decodeText, parseCsv, sniff, type Sniffed } from "@/lib/sniff";
import { downloadBlob } from "@/lib/csv";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { getState, mutate, setState } from "@/lib/store";
import type { DemoState, FileItem, User } from "@/lib/types";
import { PdfPreview } from "./pdf-preview";
import { useToast } from "./toast";
import { Button, EmptyState, Field, Modal, inputClass } from "./ui";
import { useT } from "@/lib/i18n";

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

type Preview =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "empty" }
  | { status: "ready"; kind: PreviewKind | "binary"; blob: Blob; url: string; openUrl?: string; text?: string; note?: string };
type Loaded = { fileId: string } & Preview;

const KIND_OF: Record<Sniffed, PreviewKind> = { pdf: "pdf", png: "image", jpeg: "image", gif: "image", webp: "image", bmp: "image", heic: "image", tiff: "image", svg: "image", html: "text", zip: "none" };

/**
 * Decides how to show a file from its bytes, not only its name: a PNG renamed .pdf
 * shows as an image, a binary file renamed .txt isn't dumped as text. "Open in new
 * tab" only gets types that can't run script on this site (PDF, raster images,
 * plain text); an uploaded SVG or HTML page would otherwise run with the app's storage.
 */
async function inspect(file: FileItem, blob: Blob): Promise<Preview> {
  if (blob.size === 0) return { status: "empty" };
  const head = new Uint8Array(await blob.slice(0, 64 * 1024).arrayBuffer());
  const sniffed = sniff(head);
  const declared = previewKind(file.mime, file.name);
  let kind: PreviewKind | "binary" = sniffed ? KIND_OF[sniffed] : declared;
  const note = sniffed && KIND_OF[sniffed] !== declared && !(sniffed === "zip" && declared === "none") ? `This file is a ${LABEL[sniffed]}, although its name or type says otherwise.` : undefined;
  let text: string | undefined;
  if (kind === "text") {
    text = decodeText(head) ?? undefined;
    if (text === undefined) kind = "binary";
  }
  if (!sniffed && declared === "none" && blob.size) {
    const maybe = decodeText(head.subarray(0, 4096));
    if (maybe !== null && /\.(log|ini|cfg|conf|ya?ml|xml|tsv|sql)$/i.test(file.name)) {
      kind = "text";
      text = decodeText(head) ?? maybe;
    }
  }
  const typed = sniffed && RASTER[sniffed] ? new Blob([blob], { type: RASTER[sniffed] }) : sniffed === "svg" ? new Blob([blob], { type: "image/svg+xml" }) : blob;
  const url = URL.createObjectURL(typed);
  let openUrl: string | undefined;
  if (sniffed === "pdf") openUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  else if (sniffed && RASTER[sniffed]) openUrl = url;
  else if (kind === "text" && text !== undefined && blob.size <= head.length) openUrl = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  return { status: "ready", kind, blob, url, openUrl, text, note };
}

export function PreviewDialog({ file, state, user, onClose }: { file: FileItem | null; state: DemoState; user: User; onClose: () => void }) {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const preview: Preview = loaded && loaded.fileId === file?.id ? loaded : { status: "loading" };
  const download = useDownload(user);

  useEffect(() => {
    if (!file) return;
    let urls: string[] = [];
    let cancelled = false;
    loadFileBlob(state, file).then(async (blob) => {
      if (cancelled) return;
      if (!blob) return setLoaded({ fileId: file.id, status: "missing" });
      const p = await inspect(file, blob);
      if (p.status === "ready") urls = [...new Set([p.url, p.openUrl].filter((u): u is string => !!u))];
      if (cancelled) return urls.forEach((u) => URL.revokeObjectURL(u));
      setLoaded({ fileId: file.id, ...p });
    });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // Regenerate only when a different file is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  const uploader = state.users.find((u) => u.id === file?.uploadedBy)?.name ?? t("Unknown");

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title={file?.name ?? ""}
      wide
      footer={
        file && (
          <>
            {preview.status === "ready" && preview.openUrl && (
              <a href={preview.openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                <ExternalLink className="size-4" aria-hidden /> {t("Open in new tab")}
              </a>
            )}
            <Button variant="primary" onClick={() => download(file)}>
              <Download className="size-4" /> {t("Download")}
            </Button>
          </>
        )
      }
    >
      {file && (
        <>
          <p className="mb-3 text-xs text-muted">
            {formatBytes(file.size)} · {t("uploaded by {name}", { name: uploader })} · {formatDateTime(file.createdAt)}
            {file.seed && " · synthetic sample content"}
          </p>
          {preview.status === "ready" && preview.note && (
            <p className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-warning" role="note">
              {t(preview.note)}
            </p>
          )}
          <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
            {preview.status === "loading" && (
              <div className="flex h-72 items-center justify-center text-muted" role="status">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                <span className="sr-only">{t("Loading preview")}</span>
              </div>
            )}
            {preview.status === "missing" && <EmptyState icon={File} title={t("File content not found")} text={t("The bytes for this upload are no longer in this browser's storage. Delete the entry or upload it again.")} />}
            {preview.status === "empty" && <EmptyState icon={File} title={t("This file is empty")} text={t("It has no content (0 bytes). Ask the sender to upload it again.")} />}
            {preview.status === "ready" && preview.kind === "image" && <ImagePreview key={file.id} url={preview.url} name={file.name} />}
            {preview.status === "ready" && preview.kind === "pdf" && <PdfPreview blob={preview.blob} name={file.name} />}
            {preview.status === "ready" && preview.kind === "text" && preview.text !== undefined && (
              /\.(csv|tsv)$/i.test(file.name) || /csv|tab-separated/.test(file.mime) ? (
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <tbody>
                      {parseCsv(preview.text).map((row, i) => (
                        <tr key={i} className={i === 0 ? "bg-surface font-semibold" : "border-t border-border"}>
                          {row.map((c, j) => (
                            <td key={j} className="px-3 py-1.5 whitespace-pre">
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
            {preview.status === "ready" && preview.kind === "binary" && <EmptyState icon={File} title={t("This file isn't readable text")} text={t("Its name says text, but the content is binary data. Download it to open it with the right app.")} />}
            {preview.status === "ready" && preview.kind === "none" && <EmptyState icon={File} title={t("No preview for this file type")} text={t("Download the file to open it on your device.")} />}
          </div>
        </>
      )}
    </Modal>
  );
}

export function ShareDialog({ file, state, user, onClose }: { file: FileItem | null; state: DemoState; user: User; onClose: () => void }) {
  const t = useT();
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
    <Modal open={!!file} onClose={onClose} title={file ? t("Share {name}", { name: file.name }) : ""}>
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted">{t("Anyone with the link can download this file until it expires. In this demo, links only open in the same browser because data never leaves it.")}</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t("Link expires after")}>
                {(id) => (
                  <select id={id} className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    <option value={1}>{t("1 day")}</option>
                    <option value={7}>{t("7 days")}</option>
                    <option value={30}>{t("30 days")}</option>
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
              <Link2 className="size-4" /> {t("Create link")}
            </Button>
          </div>

          {links.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">{t("Active links")}</h3>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <input readOnly value={urlFor(l.token)} aria-label={t("Share link")} className={`${inputClass} h-9 font-mono text-xs`} onFocus={(e) => e.target.select()} />
                      <button onClick={() => copy(l.token)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("Copy link")}>
                        {copied === l.token ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                      </button>
                      {canRevokeShare(user, l) && (
                        <button onClick={() => run(() => mutate((s) => revokeShare(s, user, l.id)), "Link revoked.")} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label={t("Revoke link")}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {t("Expires {date}", { date: formatDate(l.expiresAt) })} · {t(l.downloads === 1 ? "{n} download" : "{n} downloads", { n: l.downloads })}
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

/** Shows an image, or says so when the browser cannot decode it (iPhone HEIC photos, TIFF scans). */
function ImagePreview({ url, name }: { url: string; name: string }) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  if (broken)
    return (
      <EmptyState
        icon={FileImage}
        title={t("This image can't be shown in the browser")}
        text={t("{type} photos (common from iPhones and scanners) aren't supported by web browsers. Download it to open it on your device.", { type: name.split(".").pop()?.toUpperCase() ?? "" })}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Preview of ${name}`} onError={() => setBroken(true)} className="mx-auto max-h-[60vh] w-auto object-contain" />;
}
