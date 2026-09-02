import { Check } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface SelectOption {
  value: string;
  label: string;
}

interface FieldShellProps {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, help, children, className }: FieldShellProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {help && (
        <p className="text-xs leading-5 text-muted-foreground">{help}</p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  help?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  help,
  disabled,
  className,
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} className={className}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        className={CONTROL_CLASS}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  help?: string;
  className?: string;
}

export function TextField({
  label,
  value,
  onChange,
  maxLength = 80,
  help,
  className,
}: TextFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next) onChange(next);
    else setDraft(value);
  }

  return (
    <FieldShell id={id} label={label} help={help} className={className}>
      <input
        id={id}
        type="text"
        value={draft}
        maxLength={maxLength}
        className={CONTROL_CLASS}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </FieldShell>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  help?: string;
  className?: string;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  help,
  className,
}: NumberFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} className={className}>
      <div className="relative">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          className={cn(CONTROL_CLASS, suffix && "pr-9 tabular-nums")}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
              onChange(Math.min(max, Math.max(min, next)));
            }
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-3 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

interface ChoiceChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export function ChoiceChip({
  selected,
  onClick,
  children,
  disabled,
}: ChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-background/50 text-foreground hover:bg-accent"
      )}
      onClick={onClick}
    >
      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </button>
  );
}

export function GradeBadge({ grade }: { grade: string | null }) {
  return (
    <Badge
      variant={grade === null ? "outline" : "secondary"}
      className={cn(
        "min-w-8 justify-center tabular-nums",
        grade === "S" && "border-primary/40 bg-primary/15 text-primary"
      )}
    >
      {grade ?? "—"}
    </Badge>
  );
}

export function ScoreBar({ value, label }: { value: number; label: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bounded}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}
