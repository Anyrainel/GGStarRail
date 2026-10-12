import { type CSSProperties, useId } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { MemberAvatar } from "@/components/teams/team/MemberAvatar";
import { TeamCharacterGrid } from "@/components/teams/team/TeamCharacterGrid";
import { useTeamDmgData } from "@/components/teams/team/TeamDmgData";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { formatDamage, formatPercent } from "@/services/combat/presentation";
import { signedPercent } from "./InvestmentChart";
import type { MemberPath, OrderRow, PathPoint } from "./investmentModel";

/** Copy labels shared by the investment views. */
export interface CopyLabels {
  readonly eidolon: (value: number) => string;
  readonly superimposition: (value: number) => string;
  readonly state: (point: PathPoint) => string;
}

/** A tiny square crop of a Light Cone's art. */
function LightConeThumb({ id }: { id: string }) {
  const { lookup } = useTeamDmgData();
  const item = lookup.lightCones.get(id);
  return (
    <span
      className="relative inline-block h-4 w-4 shrink-0 overflow-hidden rounded-sm bg-muted"
      title={item?.name}
    >
      <AssetImage
        kind="light-cone"
        id={id}
        sourcePath={item?.iconPath}
        alt={item?.name ?? id}
        draggable={false}
        className="absolute -left-[6%] -top-[4%] h-[112%] w-[112%] max-w-none object-cover object-top"
      />
    </span>
  );
}

function ChangeCell({
  point,
  path,
  labels,
}: {
  point: PathPoint;
  path: MemberPath;
  labels: CopyLabels;
}) {
  const { t } = useI18n();
  const step = point.step;
  if (!step)
    return (
      <span className="text-muted-foreground">
        {t("teamInvestment.current")}
      </span>
    );
  if (step.kind === "eidolon")
    return (
      <span className="whitespace-nowrap tabular-nums">
        {labels.eidolon(step.fromLevel)}→{labels.eidolon(step.toLevel)}
      </span>
    );
  return (
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      {path.lightConeId && <LightConeThumb id={path.lightConeId} />}
      {labels.superimposition(step.fromLevel)}→
      {labels.superimposition(step.toLevel)}
    </span>
  );
}

/** One table per member: every copy of its path, the start state first. */
export function InvestmentTables({
  paths,
  points,
  labels,
}: {
  paths: readonly MemberPath[];
  points: ReadonlyMap<number, readonly PathPoint[]>;
  labels: CopyLabels;
}) {
  const { locale, t } = useI18n();
  const { lookup } = useTeamDmgData();
  return (
    <TeamCharacterGrid className="w-full" gridClassName="gap-2">
      {paths.map((path) => {
        const name =
          lookup.characters.get(path.characterId)?.name ?? path.characterId;
        return (
          <section
            key={path.slot}
            aria-label={name}
            data-investment-table={path.slot}
            className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border"
          >
            <header className="flex items-center gap-1 border-b border-border px-1.5 py-1.5 lg:px-1 2xl:px-1.5 lg:gap-1.5 lg:px-2">
              <MemberAvatar characterId={path.characterId} decorative />
              <span className="min-w-0 truncate text-xs font-bold md:text-sm lg:text-xs xl:text-sm">
                {name}
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[18rem] text-xs md:text-sm lg:text-xs 2xl:text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th
                      scope="col"
                      className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right font-semibold"
                    >
                      {t("teamInvestment.copies")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-left font-semibold"
                    >
                      {t("teamInvestment.state")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right font-semibold"
                    >
                      {t("teamInvestment.teamDmg")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right font-semibold"
                    >
                      {t("teamInvestment.vsPrev")}
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-left font-semibold"
                    >
                      {t("teamInvestment.change")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(points.get(path.slot) ?? []).map((point) => (
                    <tr
                      key={point.copies}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right font-bold tabular-nums">
                        {point.copies}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 tabular-nums">
                        {labels.state(point)}
                      </td>
                      <td
                        className="whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right tabular-nums"
                        title={formatDamage(point.damage, locale)}
                      >
                        {formatPercent(point.percent / 100, locale)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-1.5 py-1.5 lg:px-1 2xl:px-1.5 text-right tabular-nums",
                          point.vsPrevious === null
                            ? "text-muted-foreground"
                            : point.vsPrevious < 0
                              ? "text-destructive"
                              : "text-primary"
                        )}
                      >
                        {point.vsPrevious === null
                          ? "—"
                          : signedPercent(point.vsPrevious, locale)}
                      </td>
                      <td className="px-1.5 py-1.5 lg:px-1 2xl:px-1.5">
                        <ChangeCell point={point} path={path} labels={labels} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </TeamCharacterGrid>
  );
}

/**
 * Every member's path merged into one purchase order: each row offers every
 * member's next copy (one column per member) and takes the one that gains
 * the most. Phones show only the copy taken.
 */
export function CombinedOrder({
  rows,
  slots,
  labels,
}: {
  rows: readonly OrderRow[];
  /** Member slots in team order; one column each. */
  slots: readonly number[];
  labels: CopyLabels;
}) {
  const { locale, t } = useI18n();
  const { lookup } = useTeamDmgData();
  const titleId = useId();
  const columns = {
    "--order-columns": String(slots.length),
  } as CSSProperties;
  return (
    <section
      aria-labelledby={titleId}
      className="w-full space-y-2"
      data-investment-order
    >
      <h4
        id={titleId}
        className="text-center text-sm font-bold tracking-tight md:text-base"
      >
        {t("teamInvestment.order.title")}
      </h4>
      <div
        aria-hidden
        className="hidden items-center gap-1.5 px-1 text-xs text-muted-foreground sm:flex sm:justify-center md:gap-2"
      >
        <span className="w-6 shrink-0" />
        <div
          className="grid gap-1 [grid-template-columns:repeat(var(--order-columns),7.5rem)]"
          style={columns}
        >
          {slots.map((slot) => {
            const characterId = rows
              .flatMap((row) => row.candidates)
              .find((entry) => entry.slot === slot)?.characterId;
            return (
              <span
                key={slot}
                className="flex min-w-0 items-center gap-1 px-1.5"
              >
                {characterId && (
                  <>
                    <MemberAvatar
                      characterId={characterId}
                      size="xs"
                      decorative
                    />
                    <span className="truncate font-semibold">
                      {lookup.characters.get(characterId)?.name ?? characterId}
                    </span>
                  </>
                )}
              </span>
            );
          })}
        </div>
        <span className="w-16 shrink-0 text-right font-semibold">
          {t("teamInvestment.teamDmg")}
        </span>
      </div>
      <ol className="space-y-1 px-1">
        {rows.map((row) => {
          const taken = row.candidates[row.chosen];
          return (
            <li
              key={row.copies}
              className="flex items-center gap-1.5 sm:justify-center md:gap-2"
              data-order-row={row.copies}
            >
              <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums md:text-sm">
                {row.copies}
              </span>
              <div
                className="grid grid-cols-1 gap-1 sm:[grid-template-columns:repeat(var(--order-columns),7.5rem)]"
                style={columns}
              >
                {slots.map((slot) => {
                  const candidate = row.candidates.find(
                    (entry) => entry.slot === slot
                  );
                  if (!candidate)
                    return (
                      <span
                        key={slot}
                        className="hidden sm:block"
                        aria-hidden
                      />
                    );
                  const chosen = candidate === taken;
                  const name =
                    lookup.characters.get(candidate.characterId)?.name ??
                    candidate.characterId;
                  return (
                    <span
                      key={slot}
                      data-chosen={chosen || undefined}
                      className={cn(
                        "items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 py-0.5 text-xs",
                        chosen
                          ? "inline-flex border-primary/40 bg-primary/10 font-semibold"
                          : "hidden border-border text-muted-foreground sm:inline-flex"
                      )}
                    >
                      <MemberAvatar
                        characterId={candidate.characterId}
                        size="xs"
                        decorative
                      />
                      <span className="sr-only">{name}</span>
                      <span className="font-mono">
                        {candidate.kind === "eidolon"
                          ? labels.eidolon(candidate.level)
                          : labels.superimposition(candidate.level)}
                      </span>
                      <span
                        className={cn(
                          "ml-auto pl-1 font-mono tabular-nums",
                          candidate.gain < 0 && "text-destructive"
                        )}
                      >
                        {signedPercent(candidate.gain, locale)}
                      </span>
                    </span>
                  );
                })}
              </div>
              <span className="ml-auto w-16 shrink-0 text-right font-mono text-xs font-bold tabular-nums sm:ml-0 md:text-sm">
                {formatPercent(row.percent / 100, locale)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
