import { Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { cn } from "@/lib/utils";

const DESELECT_VALUE = "__DESELECT__";

interface StatOption {
  value: string;
  label: string;
  compactLabel: string;
}

interface StatSelectProps {
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  options: readonly StatOption[];
  maxLength: number;
  minimumLength?: number;
  compact?: boolean;
  label?: string;
  addLabel: string;
  deselectLabel: string;
}

interface StatSelectItemProps {
  value: string;
  onValueChange: (value: string) => void;
  availableOptions: readonly StatOption[];
  autoOpen?: boolean;
  compact?: boolean;
  canDeselect: boolean;
  deselectLabel: string;
  ariaLabel: string;
}

function StatSelectItem({
  value,
  onValueChange,
  availableOptions,
  autoOpen = false,
  compact = false,
  canDeselect,
  deselectLabel,
  ariaLabel,
}: StatSelectItemProps) {
  const selected = availableOptions.find((option) => option.value === value);

  return (
    <LightweightSelect
      value={value}
      onValueChange={onValueChange}
      defaultOpen={autoOpen}
    >
      <LightweightSelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-7 w-auto bg-gradient-select text-sm hover:brightness-110",
          compact ? "min-w-12" : "min-w-[4.5rem]"
        )}
      >
        {selected ? (
          <span>{selected.compactLabel}</span>
        ) : (
          <LightweightSelectValue />
        )}
      </LightweightSelectTrigger>
      <LightweightSelectContent collisionPadding={8}>
        <LightweightSelectItem
          value={DESELECT_VALUE}
          disabled={!canDeselect}
          className="text-sm text-muted-foreground"
        >
          {deselectLabel}
        </LightweightSelectItem>
        {availableOptions.map((option) => (
          <LightweightSelectItem
            key={option.value}
            value={option.value}
            className="text-sm"
          >
            {option.label}
          </LightweightSelectItem>
        ))}
      </LightweightSelectContent>
    </LightweightSelect>
  );
}

function StatSelectComponent({
  values,
  onValuesChange,
  options,
  maxLength,
  minimumLength = 0,
  compact = false,
  label,
  addLabel,
  deselectLabel,
}: StatSelectProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddValue = useCallback(
    (value: string) => {
      if (value !== DESELECT_VALUE && value && !values.includes(value)) {
        onValuesChange([...values, value]);
      }
      setIsAdding(false);
    },
    [onValuesChange, values]
  );

  const handleUpdateValue = useCallback(
    (index: number, value: string) => {
      if (value === DESELECT_VALUE) {
        if (values.length > minimumLength) {
          onValuesChange(values.filter((_, itemIndex) => itemIndex !== index));
        }
        return;
      }
      if (value) {
        const nextValues = [...values];
        nextValues[index] = value;
        onValuesChange(nextValues);
      }
    },
    [minimumLength, onValuesChange, values]
  );

  const availableOptions = useMemo(
    () => options.filter((option) => !values.includes(option.value)),
    [options, values]
  );
  const canAddMore = values.length < maxLength && availableOptions.length > 0;

  const optionsForValue = useCallback(
    (currentIndex: number) => {
      const otherValues = values.filter(
        (_, itemIndex) => itemIndex !== currentIndex
      );
      return options.filter((option) => !otherValues.includes(option.value));
    },
    [options, values]
  );

  return (
    <div className={cn("min-w-0", label && "space-y-0.5")}>
      {label && (
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              "truncate font-medium text-muted-foreground select-none",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {label}
          </span>
          {canAddMore && !isAdding && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={addLabel}
              onClick={() => setIsAdding(true)}
              className="h-5 w-5 bg-primary/5 p-0 text-primary/70 transition-transform hover:scale-[1.2] hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      <div className="flex min-h-7 flex-wrap items-center gap-1 text-sm">
        {values.map((value, index) => (
          <StatSelectItem
            key={value}
            value={value}
            onValueChange={(newValue) => handleUpdateValue(index, newValue)}
            availableOptions={optionsForValue(index)}
            compact={compact}
            canDeselect={values.length > minimumLength}
            deselectLabel={deselectLabel}
            ariaLabel={`${label ?? addLabel}: ${
              options.find((option) => option.value === value)?.label ?? value
            }`}
          />
        ))}

        {!label && canAddMore && !isAdding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={addLabel}
            onClick={() => setIsAdding(true)}
            className={cn(
              "p-0 text-muted-foreground",
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
          >
            <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
        )}

        {isAdding && (
          <StatSelectItem
            value=""
            onValueChange={handleAddValue}
            availableOptions={availableOptions}
            autoOpen
            compact={compact}
            canDeselect
            deselectLabel={deselectLabel}
            ariaLabel={addLabel}
          />
        )}
      </div>
    </div>
  );
}

export const StatSelect = memo(StatSelectComponent);
