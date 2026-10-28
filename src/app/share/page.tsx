"use client";

import { Download, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/app-shell";
import { FileIcon, loadFileBlob } from "@/components/file-dialogs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";
import { resolveShare } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import { formatBytes, formatDate } from "@/lib/format";
import { getState, setState, useStore } from "@/lib/store";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export default function SharePage() {
  const { state } = useStore();
  const token = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => null);

  if (!state || token === null) return <Spinner />;
  const result = token ? resolveShare(state, token) : { error: "This link is missing its token." };
  const company = "file" in result ? state.companies.find((c) => c.id === result.file.companyId) : undefined;

  const download = async () => {
    if (!("file" in result)) return;
    const blob = await loadFileBlob(getState(), result.file);
    if (!blob) return;
    downloadBlob(blob, result.file.name);
    const s = getState();
    setState({ ...s, shares: s.shares.map((x) => (x.id === result.share.id ? { ...x, downloads: x.downloads + 1 } : x)) });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">
        <Card className="w-full max-w-md">
          {"error" in result ? (
            <EmptyState icon={LinkIcon} title="Link unavailable" text={result.error} action={<Link href="/" className="text-sm font-medium text-accent underline">Go to Atlas Portal</Link>} />
          ) : (
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2">
                <FileIcon file={result.file} className="size-7" />
              </div>
              <p className="text-xs tracking-wide text-muted uppercase">{company?.name} shared a file</p>
              <h1 className="mt-1 text-lg font-semibold break-words">{result.file.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {formatBytes(result.file.size)} · link expires {formatDate(result.share.expiresAt)}
              </p>
              <Button variant="primary" className="mt-6 w-full" onClick={download}>
                <Download className="size-4" /> Download
              </Button>
              <p className="mt-4 text-xs text-muted">Demo share link: it resolves from this browser&apos;s storage, so it only opens on the device that created it.</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
