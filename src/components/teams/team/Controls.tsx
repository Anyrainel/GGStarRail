import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { cn } from "@/lib/utils";

/** A centred row of inline label-left controls; the run button goes last. */
export function ControlsRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 md:gap-x-5 md:gap-y-2",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A label and its control; the label names the control for assistive tech. */
export function ControlField({
  label,
  children,
  suffix,
}: {
  label: string;
  /** Receives the id the label points at. */
  children: (id: string) => ReactNode;
  suffix?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-1 md:gap-1.5">
      <label
        htmlFor={id}
        className="select-none whitespace-nowrap text-[10px] font-semibold md:text-sm"
      >
        {label}
      </label>
      {children(id)}
      {suffix && (
        <span className="text-[10px] font-semibold text-muted-foreground md:text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}

interface CompactNumberInputProps {
  value: number | null;
  /** Called with the clamped value, or null when cleared (if allowed). */
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** An empty field means "no value" (e.g. no constraint). */
  allowEmpty?: boolean;
  id?: string;
  label?: string;
  /** Id of a visible element that names the field. */
  labelledBy?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** A small centred number field that commits on blur or Enter. */
export function CompactNumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  allowEmpty = false,
  id,
  label,
  labelledBy,
  placeholder,
  className,
  disabled,
}: CompactNumberInputProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (allowEmpty) {
        if (value !== null) onCommit(null);
      } else setDraft(value === null ? "" : String(value));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    const clamped = Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min ?? Number.NEGATIVE_INFINITY, parsed)
    );
    const rounded = step >= 1 ? Math.round(clamped) : clamped;
    setDraft(String(rounded));
    if (rounded !== value) onCommit(rounded);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      aria-label={label}
      aria-labelledby={labelledBy}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        "h-6 w-10 rounded-md border border-border bg-background/30 px-1 text-center text-xs font-bold tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 md:h-7 md:w-12 md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]",
        className
      )}
    />
  );
}

export interface CompactSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CompactSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly CompactSelectOption[];
  /** Accessible name (no visible label). */
  label?: string;
  /** Id of a visible element that names the select. */
  labelledBy?: string;
  id?: string;
  /** Text shown in the trigger instead of the option label. */
  display?: ReactNode;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

/** A dense select for control rows and roster tiles. */
export function CompactSelect({
  value,
  onValueChange,
  options,
  label,
  labelledBy,
  id,
  display,
  disabled,
  className,
  contentClassName,
}: CompactSelectProps) {
  return (
    <LightweightSelect
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <LightweightSelectTrigger
        id={id}
        aria-label={label}
        aria-labelledby={labelledBy}
        className={cn(
          "h-6 w-auto gap-0.5 border-border bg-background/30 px-1.5 py-0 text-xs font-bold shadow-none md:h-7 md:text-sm",
          className
        )}
      >
        {display !== undefined ? (
          <span className="min-w-0 truncate">{display}</span>
        ) : (
          <LightweightSelectValue />
        )}
      </LightweightSelectTrigger>
      <LightweightSelectContent
        collisionPadding={8}
        className={cn("max-h-80", contentClassName)}
      >
        {options.map((option) => (
          <LightweightSelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </LightweightSelectItem>
        ))}
      </LightweightSelectContent>
    </LightweightSelect>
  );
}
