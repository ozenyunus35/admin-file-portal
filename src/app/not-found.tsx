"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const t = useT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-2xl font-semibold">{t("Page not found")}</h1>
      <p className="text-sm text-muted">{t("The page you're looking for doesn't exist.")}</p>
      <Link href="/" className="mt-2 text-sm font-medium text-accent underline">
        {t("Back to Atlas Portal")}
      </Link>
    </main>
  );
}
