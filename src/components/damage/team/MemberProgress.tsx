import { Check, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MemberJobStatus = "pending" | "running" | "done" | "failed";

export interface MemberProgressEntry {
  readonly key: string;
  readonly label: string;
  readonly status: MemberJobStatus;
  /** Shown after the label when done (e.g. best damage). */
  readonly value?: ReactNode;
  /** 0–1, drawn by ring chips. */
  readonly progress?: number;
}

/** A thin determinate bar (0–1). */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

function Ring({
  status,
  progress,
}: {
  status: MemberJobStatus;
  progress: number;
}) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const filled = status === "done" ? 1 : Math.max(0, Math.min(1, progress));
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("h-4 w-4 shrink-0", status === "running" && "animate-spin")}
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        strokeWidth="2.5"
        className="stroke-border"
      />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-primary"
        strokeDasharray={circumference}
        strokeDashoffset={
          circumference *
          (1 - (status === "running" && filled === 0 ? 0.25 : filled))
        }
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

/**
 * Progress of a multi-member run: phase and percentage, a bar, then one chip
 * per member (done, running, pending).
 */
export function MemberProgress({
  phase,
  value,
  entries,
  variant = "chip",
  className,
}: {
  phase: string;
  /** Overall 0–1. */
  value: number;
  entries: readonly MemberProgressEntry[];
  variant?: "chip" | "ring";
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-3 rounded-lg border border-border p-3", className)}
      data-member-progress
    >
      <div className="flex justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-semibold">{phase}</span>
        <span className="font-mono font-bold tabular-nums">
          {Math.round(Math.max(0, Math.min(1, value)) * 100)}%
        </span>
      </div>
      <ProgressBar value={value} label={phase} />
      {entries.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <li
              key={entry.key}
              data-status={entry.status}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                entry.status === "done"
                  ? "border-primary/40 bg-primary/10"
                  : entry.status === "failed"
                    ? "border-destructive/50 bg-destructive/10"
                    : entry.status === "running"
                      ? "border-border"
                      : "border-border text-muted-foreground"
              )}
            >
              {variant === "ring" ? (
                <Ring status={entry.status} progress={entry.progress ?? 0} />
              ) : entry.status === "done" ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : entry.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : entry.status === "failed" ? (
                <X className="h-3 w-3" aria-hidden />
              ) : null}
              <span className="max-w-[10rem] truncate">{entry.label}</span>
              {entry.status === "done" && entry.value !== undefined && (
                <span className="font-mono tabular-nums">{entry.value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
