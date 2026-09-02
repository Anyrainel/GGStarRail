import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "info" | "error";

export function StatusBanner({
  message,
  tone = "info",
  className,
}: {
  message: string;
  tone?: StatusTone;
  className?: string;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "error" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "success" && "border-primary/35 bg-primary/10",
        tone === "info" && "border-border bg-background/55",
        tone === "error" && "border-destructive/45 bg-destructive/10",
        className
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "error" ? "text-destructive" : "text-primary"
        )}
        aria-hidden="true"
      />
      <p className="min-w-0 leading-5">{message}</p>
    </div>
  );
}
