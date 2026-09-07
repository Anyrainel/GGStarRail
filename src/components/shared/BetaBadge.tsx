import { Badge } from "@/components/ui/badge";
import { isBetaEntity } from "@/data/gameDataLoader";

export function BetaBadge({
  member,
  id,
}: {
  member: string;
  id: string | number;
}) {
  return isBetaEntity(member, id) ? (
    <Badge variant="outline">BETA</Badge>
  ) : null;
}
