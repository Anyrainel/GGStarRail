import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { formatGameTextVariants } from "@/lib/gameTextVariants";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type { LocalizedText } from "@/providers/reference/types";

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
  normal_max_level?: number;
  max_level?: number;
  condition_description?: LocalizedText | null;
  condition_parameters?: readonly number[];
}

/** Stable numbered references connect the description to its comparison rows. */
export function skillComparisonRows(template: string) {
  const plain = formatGameText(template);
  const rows: { index: number; token: string; number: number }[] = [];
  const seen = new Set<string>();
  for (const match of plain.matchAll(/#(\d+)(?:\[[^\]]+\])?%?/g)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    rows.push({
      index: Number(match[1]) - 1,
      token: match[0],
      number: rows.length + 1,
    });
  }
  return rows;
}

interface ComparisonRow {
  index: number;
  token: string;
  number: number;
  source: "full" | "simple";
}

export function skillComparisonPlan(
  fullText: string,
  simpleText: string,
  levels: readonly SkillLevel[],
  useSimple: boolean
) {
  const source = fullText.trim() ? "full" : "simple";
  const rows: ComparisonRow[] = skillComparisonRows(
    source === "full" ? fullText : simpleText
  ).map((row) => ({ ...row, source }));
  const descriptionNumbers = new Map(
    rows.map((row) => [row.token, row.number])
  );
  if (useSimple && source === "full") {
    descriptionNumbers.clear();
    for (const simple of skillComparisonRows(simpleText)) {
      // Brief descriptions have their own parameter arrays. A token index alone
      // does not establish that it refers to the same full-description value.
      const matches = rows.filter(
        (row) =>
          row.source === "full" &&
          levels.length > 0 &&
          levels.every((level) => {
            const simpleParameters =
              level.simple_parameters ?? level.parameters;
            const simpleValue = simpleParameters[simple.index];
            const fullValue = level.parameters[row.index];
            return (
              simpleValue !== undefined &&
              fullValue !== undefined &&
              simpleValue === fullValue &&
              formatGameText(simple.token, simpleParameters) ===
                formatGameText(row.token, level.parameters)
            );
          })
      );
      const existing = matches.length === 1 ? matches[0] : undefined;
      const number = existing?.number ?? rows.length + 1;
      if (!existing) rows.push({ ...simple, number, source: "simple" });
      descriptionNumbers.set(simple.token, number);
    }
  }
  return { rows, descriptionNumbers };
}

function ValueMarker({ number }: { number: number }) {
  const { t } = useI18n();
  return (
    <span
      title={t("archive.skillValueNumber", { value: number })}
      className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded border border-primary/25 bg-primary/10 px-1 text-xs font-semibold leading-5 text-primary"
    >
      {number}
    </span>
  );
}

function NumberedDescription({
  text,
  numbers,
}: {
  text: string;
  numbers: ReadonlyMap<string, number>;
}) {
  const { t } = useI18n();
  const plain = formatGameText(text, [], t("terms.trailblazer"));
  const content: ReactNode[] = [];
  let previous = 0;
  for (const match of plain.matchAll(/#(\d+)(?:\[[^\]]+\])?%?/g)) {
    content.push(plain.slice(previous, match.index));
    const number = numbers.get(match[0]);
    if (number === undefined)
      throw new Error("Missing description comparison reference");
    content.push(<ValueMarker key={match.index} number={number} />);
    previous = match.index + match[0].length;
  }
  content.push(plain.slice(previous));
  return <>{content}</>;
}

export function defaultSkillComparisonLevels(
  skill: SkillContent
): [number, number] {
  const available = skill.levels.map((level) => level.level);
  const first = available[0] ?? 1;
  const highest = available.at(-1) ?? first;
  const normal = available.includes(skill.normal_max_level ?? highest)
    ? (skill.normal_max_level ?? highest)
    : highest;
  const enhanced = available.includes(skill.max_level ?? highest)
    ? (skill.max_level ?? highest)
    : highest;
  return enhanced > normal ? [normal, enhanced] : [first, normal];
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
  comparisonVariants,
}: {
  skill: SkillContent;
  descriptionMode: CharacterDescriptionMode;
  comparisonVariants?: readonly {
    label: string;
    levels: readonly SkillLevel[];
    condition_parameters?: readonly number[];
  }[];
}) {
  const { locale, t } = useI18n();
  const [defaults] = useState(() => defaultSkillComparisonLevels(skill));
  const [leftLevel, setLeftLevel] = useState(defaults[0]);
  const [rightLevel, setRightLevel] = useState(defaults[1]);
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
  const { rows, descriptionNumbers } = skillComparisonPlan(
    fullText,
    shortText,
    comparisonVariants?.length
      ? comparisonVariants.flatMap((variant) => variant.levels)
      : skill.levels,
    useSimple
  );
  const chips = [skill.type_description, skill.tag]
    .flatMap((value) =>
      value ? [formatGameText(getLocalizedValue(value, locale))] : []
    )
    .filter((value, index, all) => value && all.indexOf(value) === index);
  const showTable = rows.length > 0;
  const cellValue = (row: ComparisonRow, selected: SkillLevel | undefined) => {
    const parametersFor = (level: SkillLevel | undefined) =>
      row.source === "simple"
        ? (level?.simple_parameters ?? level?.parameters ?? [])
        : (level?.parameters ?? []);
    if (!comparisonVariants?.length)
      return formatGameTextVariants(
        row.token,
        [{ parameters: parametersFor(selected) }],
        t("terms.trailblazer")
      );
    const variants = comparisonVariants.map((variant) => {
      const level = variant.levels.find(
        (entry) => entry.level === selected?.level
      );
      if (!level) throw new Error("Missing level in skill comparison variant");
      return {
        parameters: parametersFor(level),
      };
    });
    return formatGameTextVariants(row.token, variants, t("terms.trailblazer"));
  };
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
          showTable && "xl:grid-cols-[minmax(0,1fr)_auto]"
        )}
      >
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line break-words">
            <NumberedDescription text={text} numbers={descriptionNumbers} />
          </p>
          {skill.condition_description && (
            <p className="whitespace-pre-line text-muted-foreground">
              {comparisonVariants?.every(
                (variant) => variant.condition_parameters
              )
                ? formatGameTextVariants(
                    getLocalizedValue(skill.condition_description, locale),
                    comparisonVariants.map((variant) => ({
                      parameters: variant.condition_parameters!,
                    })),
                    t("terms.trailblazer")
                  )
                : formatGameText(
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
              {comparisonVariants && comparisonVariants.length > 1 && (
                <caption className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                  {comparisonVariants
                    .map((variant) => variant.label)
                    .join(" / ")}
                </caption>
              )}
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">
                    <span className="sr-only">{t("archive.skillValues")}</span>
                  </th>
                  {(skill.levels.length > 1
                    ? [
                        { value: left?.level, set: setLeftLevel },
                        { value: right?.level, set: setRightLevel },
                      ]
                    : [{ value: left?.level, set: setLeftLevel }]
                  ).map((control, index) => (
                    <th
                      key={index === 0 ? "left" : "right"}
                      className="w-20 px-1 py-1 font-medium"
                    >
                      {skill.levels.length > 1 ? (
                        <LightweightSelect
                          value={String(control.value)}
                          onValueChange={(value) => control.set(Number(value))}
                          disabled={skill.levels.length < 2}
                        >
                          <LightweightSelectTrigger
                            aria-label={t("archive.compareLevel", {
                              column: index + 1,
                            })}
                            className="h-7 min-w-[4.5rem] bg-gradient-select text-xs font-medium"
                          >
                            <LightweightSelectValue />
                          </LightweightSelectTrigger>
                          <LightweightSelectContent collisionPadding={8}>
                            {skill.levels.map((level) => (
                              <LightweightSelectItem
                                key={level.level}
                                value={String(level.level)}
                              >
                                {t("archive.level", { value: level.level })}
                              </LightweightSelectItem>
                            ))}
                          </LightweightSelectContent>
                        </LightweightSelect>
                      ) : (
                        <span>{t("archive.skillValues")}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.source}-${row.token}`}
                    className="border-t border-border"
                  >
                    <th className="px-2 py-2 text-left font-normal leading-relaxed">
                      <ValueMarker number={row.number} />
                    </th>
                    <td className="px-2 py-2 text-center font-medium tabular-nums">
                      {cellValue(row, left)}
                    </td>
                    {skill.levels.length > 1 && (
                      <td className="px-2 py-2 text-center font-medium tabular-nums">
                        {cellValue(row, right)}
                      </td>
                    )}
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
