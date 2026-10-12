import { HoverCard } from "radix-ui";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * A ranking row's detail beside the row on desktop. The trigger keeps its own
 * click behaviour; hovering it or focusing it from the keyboard shows the card.
 */
export function ChoiceHoverCard({
  children,
  content,
  disabled = false,
}: {
  children: ReactElement;
  content: ReactNode;
  /** E.g. while the same detail is open in a dialog. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Radix types the trigger as a link; with asChild it is the row's element.
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // The dialog takes over the detail; the card must not come back when it
  // closes.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  /**
   * Radix opens after a delay, by when the pointer or focus may have moved
   * on (e.g. into a dialog), and only closes on leaving the trigger or card.
   */
  function engaged(): boolean {
    const trigger = triggerRef.current;
    return Boolean(
      trigger?.matches(":hover") ||
        trigger?.matches(":focus-visible") ||
        contentRef.current?.matches(":hover")
    );
  }

  return (
    <HoverCard.Root
      open={open && !disabled}
      onOpenChange={(next) => setOpen(next && !disabled && engaged())}
      openDelay={300}
      closeDelay={100}
    >
      <HoverCard.Trigger
        asChild
        ref={triggerRef}
        onFocus={(event) => {
          // Keyboard focus only; a click focuses the row and opens the dialog,
          // so Radix's own open on focus is skipped.
          if (!event.currentTarget.matches(":focus-visible"))
            event.preventDefault();
          else if (!disabled) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onPointerDown={() => setOpen(false)}
      >
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          ref={contentRef}
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-choice-hover-card
        >
          {open && !disabled && content}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
