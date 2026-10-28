"use client";

import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { initials } from "@/lib/format";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-accent text-accent-fg shadow-[0_6px_20px_-8px_var(--accent)] hover:brightness-110 hover:shadow-[0_8px_28px_-8px_var(--accent)]",
        variant === "secondary" && "border border-border bg-surface shadow-[var(--highlight)] hover:border-border-strong hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-text",
        variant === "danger" && "bg-danger text-white hover:brightness-110 dark:text-black",
        className,
      )}
      {...props}
    />
  );
});

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl border border-border bg-surface shadow-card [box-shadow:var(--highlight),var(--shadow-card)]", className)} {...props} />;
}

/** Card header row: title on the left, optional meta or link on the right. */
export function CardHeader({ title, meta, icon: Icon }: { title: string; meta?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
        {Icon && <Icon className="size-4 text-muted" aria-hidden />}
        {title}
      </h2>
      {meta && <div className="shrink-0 text-xs text-muted">{meta}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted ring-border",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const label = typeof children === "string" && /^[a-z-]+$/.test(children) ? children[0].toUpperCase() + children.slice(1).replace("-", " ") : children;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-current/15 ring-inset", TONES[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  invited: "info",
  disabled: "neutral",
  onboarding: "info",
  paused: "warning",
  planning: "neutral",
  review: "warning",
  completed: "accent",
  "on-hold": "danger",
};

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36), background: `linear-gradient(135deg, hsl(${h} 70% 58%), hsl(${(h + 40) % 360} 65% 42%))` }}
    >
      {initials(name)}
    </span>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => React.ReactNode }) {
  const id = useId();
  const msgId = error || hint ? `${id}-msg` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(id, msgId)}
      {(error || hint) && (
        <p id={msgId} className={cx("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-[var(--highlight)] transition-shadow placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none aria-[invalid=true]:border-danger";

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl shadow-black/40", wide ? "max-w-4xl" : "max-w-lg")}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 id={titleId} className="truncate font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text" aria-label="Close dialog">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" aria-hidden />
        <div className="relative rounded-2xl border border-border bg-surface-2 p-3.5">
          <Icon className="size-6 text-accent" />
        </div>
      </div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.14em] text-accent uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Usage meter. `warn` turns it amber at 85% and red at 95% (for quotas, not for progress). */
export function Meter({ value, max, label, className, warn = true }: { value: number; max: number; label: string; className?: string; warn?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = warn && pct >= 95 ? "bg-danger" : warn && pct >= 85 ? "bg-warning" : "bg-accent";
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${Math.round(pct)}%`} className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cx("meter-fill h-full rounded-full transition-[width] duration-500", tone === "bg-accent" ? "bg-gradient-to-r from-accent-2 to-accent" : tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted" role="status">
      <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton rounded-lg", className)} aria-hidden />;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `value` on mount and eases to new values after that. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const ms = reducedMotion() ? 0 : duration;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = ms === 0 ? 1 : Math.min(1, (t - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{format(shown)}</span>;
}

/** Tiny trend line for KPI cards. Decorative: the number next to it carries the meaning. */
export function Sparkline({ data, className, color = "var(--accent)" }: { data: number[]; className?: string; color?: string }) {
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return null;
  const w = 120;
  const h = 36;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - (v / max) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cx("h-9 w-full overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sg${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} className="[stroke-dasharray:1] [stroke-dashoffset:1] [animation:draw_1.2s_ease-out_0.2s_forwards]" />
    </svg>
  );
}

/** Change versus the previous period, e.g. +12%. */
export function Delta({ current, previous, label = "vs previous 7 days" }: { current: number; previous: number; label?: string }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted">No change</span>;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={label}>
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">0%</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={label}>
      <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium", up ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
        {up ? "▲" : "▼"} {Math.abs(pct)}%
      </span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/** Circular progress, used for project completion. */
export function ProgressRing({ value, size = 44, stroke = 4, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <span role="img" aria-label={`${label}: ${value}%`} className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={value >= 100 ? "var(--success)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-medium tabular-nums">{value}%</span>
    </span>
  );
}
