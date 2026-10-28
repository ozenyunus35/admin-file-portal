"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "./ui";

const MAX_PAGES = 5;

/**
 * Renders the first pages of a PDF to canvases with pdf.js. Browsers differ a
 * lot in inline PDF support (Android Chrome has none), so we don't rely on it.
 */
export function PdfPreview({ blob, name }: { blob: Blob; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const el = host.current;
        if (cancelled || !el) return;
        const out: HTMLCanvasElement[] = [];
        const width = el.clientWidth - 32;
        const count = Math.min(doc.numPages, MAX_PAGES);
        for (let n = 1; n <= count; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(width / base.width, 2);
          const ratio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: scale * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / ratio}px`;
          canvas.className = "mx-auto mb-4 h-auto max-w-full bg-white shadow-sm last:mb-0";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${name}, page ${n} of ${doc.numPages}`);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          out.push(canvas);
        }
        el.replaceChildren(...out);
        setPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [blob, name]);

  if (status === "error") return <EmptyState icon={FileText} title="Couldn't render this PDF" text="The file may be damaged or password-protected. Download it to open it on your device." />;

  return (
    <div className="max-h-[60vh] overflow-auto">
      {status === "loading" && (
        <div className="flex h-72 items-center justify-center text-muted" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <span className="sr-only">Rendering PDF</span>
        </div>
      )}
      <div ref={host} className="p-4" data-testid="pdf-pages" />
      {status === "ready" && pages > MAX_PAGES && <p className="pb-4 text-center text-xs text-muted">Showing the first {MAX_PAGES} of {pages} pages. Download the file to see the rest.</p>}
    </div>
  );
}
