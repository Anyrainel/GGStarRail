import { AssetImage } from "@/components/shared/AssetImage";
import { cn } from "@/lib/utils";
import { useTeamDmgData } from "./TeamDmgData";

const SIZE_CLASS = {
  sm: "h-5 w-5 md:h-7 md:w-7",
  xs: "h-[18px] w-[18px]",
} as const;

/** A round Character portrait for per-member headers and chips. */
export function MemberAvatar({
  characterId,
  size = "sm",
  className,
  decorative = false,
}: {
  characterId: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Hide from assistive tech when a visible name sits beside it. */
  decorative?: boolean;
}) {
  const { lookup } = useTeamDmgData();
  const item = lookup.characters.get(characterId);
  return (
    <AssetImage
      kind="character"
      id={characterId}
      sourcePath={item?.iconPath}
      alt={decorative ? "" : (item?.name ?? characterId)}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn(
        "shrink-0 rounded-full border border-border bg-muted object-cover object-top",
        SIZE_CLASS[size],
        className
      )}
    />
  );
}
