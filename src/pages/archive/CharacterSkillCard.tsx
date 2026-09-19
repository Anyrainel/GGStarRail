import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type { LocalizedText } from "@/providers/gilore/types";

export type CharacterDescriptionMode = "short" | "full";

interface SkillLevel {
  level: number;
  parameters: readonly number[];
  simple_parameters?: readonly number[];
}

interface SkillContent {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  simple_description?: LocalizedText | null;
  tag?: LocalizedText | null;
  type_description?: LocalizedText | null;
  levels: readonly SkillLevel[];
  condition_description?: LocalizedText | null;
  condition_parameters?: readonly number[];
}

function comparisonCaptionContext(value: string, side: "before" | "after") {
  // Normalize complete tokens before shortening so a cut cannot expose [i] or %.
  const text = value.replace(/#\d+(?:\[[^\]]+\])?%?/g, "…");
  if (text.length <= 72) return text;
  if (side === "before") {
    const start = text.length - 72;
    const clipped = text.slice(start);
    const words =
      /[A-Za-z]/.test(text[start - 1]) && /^[A-Za-z]/.test(clipped)
        ? clipped.replace(/^\S+\s*/, "")
        : clipped;
    return `…${words.trimStart()}`;
  }
  const clipped = text.slice(0, 72);
  const words =
    /[A-Za-z]$/.test(clipped) && /[A-Za-z]/.test(text[72])
      ? clipped.replace(/\s*\S+$/, "")
      : clipped;
  return `${words.trimEnd()}…`;
}

/** Captions come from the player's description, never source parameter names. */
export function skillComparisonRows(template: string) {
  const plain = formatGameText(template);
  const rows: { index: number; token: string; caption: string }[] = [];
  const seen = new Set<string>();
  for (const match of plain.matchAll(/#(\d+)(?:\[[^\]]+\])?%?/g)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    const offset = match.index;
    const before =
      plain
        .slice(0, offset)
        .split(/[。.!?\n;；]/)
        .at(-1) ?? "";
    const after =
      plain.slice(offset + match[0].length).split(/[。.!?\n;；]/)[0] ?? "";
    const prefix = comparisonCaptionContext(before, "before");
    const suffix = comparisonCaptionContext(after, "after");
    rows.push({
      index: Number(match[1]) - 1,
      token: match[0],
      caption: `${prefix}…${suffix}`.trim(),
    });
  }
  return rows;
}

export function CharacterSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <details open className="group/section space-y-3" data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border pb-2 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open/section:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-3">{children}</div>
    </details>
  );
}

export function CharacterEffectCard({
  title,
  children,
  className,
  rankId,
  traceId,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  rankId?: string;
  traceId?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card/50",
        className
      )}
      data-rank-id={rankId}
      data-trace-id={traceId}
    >
      <h4 className="border-b border-border px-3 py-2.5 text-sm font-semibold">
        {title}
      </h4>
      <div className="space-y-2 p-3 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

export function CharacterSkillCard({
  skill,
  descriptionMode,
}: {
  skill: SkillContent;
  descriptionMode: CharacterDescriptionMode;
}) {
  const { locale, t } = useI18n();
  const [leftLevel, setLeftLevel] = useState(skill.levels[0]?.level ?? 1);
  const [rightLevel, setRightLevel] = useState(skill.levels.at(-1)?.level ?? 1);
  const left =
    skill.levels.find((entry) => entry.level === leftLevel) ?? skill.levels[0];
  const right =
    skill.levels.find((entry) => entry.level === rightLevel) ??
    skill.levels.at(-1);
  const fullText = getLocalizedValue(skill.description, locale);
  const shortText = getLocalizedValue(skill.simple_description, locale) ?? "";
  const useSimple =
    (descriptionMode === "short" || !fullText.trim()) &&
    Boolean(shortText.trim());
  const text = useSimple ? shortText : fullText;
  const parametersFor = (level: SkillLevel | undefined) =>
    useSimple
      ? (level?.simple_parameters ?? level?.parameters ?? [])
      : (level?.parameters ?? []);
  const leftParameters = fullText.trim()
    ? (left?.parameters ?? [])
    : parametersFor(left);
  const rightParameters = fullText.trim()
    ? (right?.parameters ?? [])
    : parametersFor(right);
  const rows = skillComparisonRows(
    fullText.trim() ? fullText : shortText
  ).filter(
    (row) =>
      leftParameters[row.index] !== undefined &&
      rightParameters[row.index] !== undefined
  );
  const chips = [skill.type_description, skill.tag]
    .flatMap((value) =>
      value ? [formatGameText(getLocalizedValue(value, locale))] : []
    )
    .filter((value, index, all) => value && all.indexOf(value) === index);
  const showTable = rows.length > 0 && skill.levels.length > 1;
  return (
    <article
      data-skill-id={skill.id}
      className="overflow-hidden rounded-lg border border-border bg-card/50"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <h4 className="text-sm font-semibold">
          {formatGameText(
            getLocalizedValue(skill.name, locale),
            [],
            t("terms.trailblazer")
          )}
        </h4>
        {chips.map((chip) => (
          <Badge
            key={chip}
            variant="secondary"
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {chip}
          </Badge>
        ))}
      </div>
      <div
        className={cn(
          "grid gap-4 border-t border-border p-3",
          showTable && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        )}
      >
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line break-words">
            {formatGameText(text, parametersFor(left), t("terms.trailblazer"))}
          </p>
          {skill.condition_description && (
            <p className="whitespace-pre-line text-muted-foreground">
              {formatGameText(
                getLocalizedValue(skill.condition_description, locale),
                skill.condition_parameters,
                t("terms.trailblazer")
              )}
            </p>
          )}
        </div>
        {showTable && (
          <div className="min-w-0 overflow-x-auto rounded-md border border-border">
            <table
              className="w-full border-collapse text-xs"
              aria-label={t("archive.skillValues")}
            >
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">
                    {t("archive.skillValues")}
                  </th>
                  {[
                    { value: left?.level, set: setLeftLevel },
                    { value: right?.level, set: setRightLevel },
                  ].map((control, index) => (
                    <th
                      key={index === 0 ? "left" : "right"}
                      className="w-20 px-1 py-1 font-medium"
                    >
                      <select
                        className="h-8 w-full rounded-md border border-border bg-background px-1 text-xs"
                        aria-label={t("archive.compareLevel", {
                          column: index + 1,
                        })}
                        value={control.value}
                        onChange={(event) =>
                          control.set(Number(event.target.value))
                        }
                      >
                        {skill.levels.map((level) => (
                          <option key={level.level} value={level.level}>
                            {t("archive.level", { value: level.level })}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.token} className="border-t border-border">
                    <th className="px-2 py-2 text-left font-normal leading-relaxed">
                      {row.caption}
                    </th>
                    <td className="px-2 py-2 text-center font-medium tabular-nums">
                      {formatGameText(row.token, leftParameters)}
                    </td>
                    <td className="px-2 py-2 text-center font-medium tabular-nums text-primary">
                      {formatGameText(row.token, rightParameters)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
