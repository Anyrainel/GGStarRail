import { Check } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactNode,
  useId,
} from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

/** A styled native checkbox; form, label and keyboard behaviour stay native. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-primary bg-transparent outline-hidden transition-colors checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={(event) => {
          onChange?.(event);
          onCheckedChange?.(event.target.checked);
        }}
        {...props}
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-primary-foreground peer-checked:block"
        strokeWidth={3}
        aria-hidden="true"
      />
    </span>
  )
);
Checkbox.displayName = "Checkbox";

interface CheckboxRowProps
  extends Omit<CheckboxProps, "children" | "className"> {
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** A checkbox with an optional icon and a truncating label. */
export function CheckboxRow({
  label,
  icon,
  className,
  id,
  ...props
}: CheckboxRowProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-1.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 xl:text-base",
        className
      )}
    >
      <Checkbox id={inputId} {...props} />
      {icon && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center xl:h-5 xl:w-5 [&>*]:h-full [&>*]:w-full">
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}
