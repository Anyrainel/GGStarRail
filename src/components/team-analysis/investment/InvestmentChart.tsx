import {
  type PointerEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MemberAvatar } from "@/components/team-analysis/team/MemberAvatar";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/combat/presentation";
import { type PathPoint, percentTicks } from "./investmentModel";

/** One member's line: identity, stroke and points (copies 0…n). */
export interface ChartSeries {
  readonly slot: number;
  readonly characterId: string;
  readonly name: string;
  readonly color: string;
  /** Dash pattern when another member shares the Combat Type. */
  readonly dash: string | undefined;
  readonly points: readonly PathPoint[];
}

const HEIGHT = 280;
const MIN_WIDTH = 480;
const MARGIN = { top: 30, right: 30, bottom: 40, left: 48 } as const;

/** A short stroke in the series' colour and dash, keying legend and tooltip rows. */
export function LineKey({
  color,
  dash,
  className,
}: {
  color: string;
  dash: string | undefined;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 18 6"
      className={cn("h-1.5 w-[18px] shrink-0", className)}
      aria-hidden="true"
    >
      <line
        x1="1"
        y1="3"
        x2="17"
        y2="3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

/**
 * Team DMG (% of the start) against copies bought, one line per member.
 * Below ~500px the plot keeps its width and scrolls inside its box.
 */
export function InvestmentChart({
  series,
  stateLabel,
}: {
  series: readonly ChartSeries[];
  stateLabel: (point: PathPoint) => string;
}) {
  const { locale, t } = useI18n();
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const width = Math.max(MIN_WIDTH, Math.round(measured ?? 0));
  const maxCopies = Math.max(
    1,
    ...series.map((entry) => entry.points.length - 1)
  );
  const ticks = useMemo(
    () =>
      percentTicks(
        series.flatMap((entry) => entry.points.map((point) => point.percent))
      ),
    [series]
  );
  const yMin = ticks[0] ?? 100;
  const yMax = ticks[ticks.length - 1] ?? 110;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (copies: number) => MARGIN.left + (copies / maxCopies) * plotWidth;
  const y = (percent: number) =>
    MARGIN.top + (1 - (percent - yMin) / (yMax - yMin || 1)) * plotHeight;
  const xStep = maxCopies > 20 ? 2 : 1;
  const xTicks = Array.from(
    { length: Math.floor(maxCopies / xStep) + 1 },
    (_, index) => index * xStep
  );
  const percentLabel = (value: number, digits = 0) =>
    formatPercent(value / 100, locale, digits);

  function track(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    const offset = (event.clientX - box.left) * scale - MARGIN.left;
    const copies = Math.round((offset / plotWidth) * maxCopies);
    setActive(Math.max(0, Math.min(maxCopies, copies)));
  }

  const activeRows =
    active === null
      ? []
      : series.flatMap((entry) => {
          const point = entry.points[active];
          return point ? [{ entry, point }] : [];
        });
  const anchor = active === null ? null : x(active);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Keep the tooltip inside the visible part of the (scrollable) plot:
  // right of the crosshair, else left of it, else against the visible edge.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const box = scrollRef.current;
    if (!tooltip || !box || anchor === null) return;
    const padding = 4;
    const visibleLeft = box.scrollLeft - padding + 4;
    const visibleRight = box.scrollLeft - padding + box.clientWidth - 4;
    const tooltipWidth = tooltip.offsetWidth;
    let left = anchor + 12;
    if (left + tooltipWidth > visibleRight) left = anchor - 12 - tooltipWidth;
    if (left < visibleLeft)
      left = Math.max(visibleLeft, visibleRight - tooltipWidth);
    tooltip.style.left = `${left}px`;
  });

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        className="overflow-x-auto px-1"
        data-investment-chart
      >
        <div
          ref={ref}
          className="relative h-[280px] w-full min-w-[480px]"
          onPointerLeave={() => setActive(null)}
        >
          <svg
            role="img"
            aria-label={t("teamInvestment.chart.label")}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block select-none"
            onPointerMove={track}
            onPointerDown={track}
          >
            <text
              x={MARGIN.left - 40}
              y={14}
              className="fill-muted-foreground text-xs"
            >
              {t("teamInvestment.teamDmg")}
            </text>
            {ticks.map((tick) => (
              <g key={`y${tick}`}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeDasharray="3 3"
                />
                <text
                  x={MARGIN.left - 6}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {percentLabel(tick)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <g key={`x${tick}`}>
                <line
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="stroke-border"
                  strokeDasharray="3 3"
                />
                <text
                  x={x(tick)}
                  y={HEIGHT - MARGIN.bottom + 15}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs tabular-nums"
                >
                  {tick}
                </text>
              </g>
            ))}
            <line
              x1={MARGIN.left}
              x2={MARGIN.left}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
              className="stroke-muted-foreground"
            />
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={HEIGHT - MARGIN.bottom}
              y2={HEIGHT - MARGIN.bottom}
              className="stroke-muted-foreground"
            />
            <text
              x={width - MARGIN.right}
              y={HEIGHT - 4}
              textAnchor="end"
              className="fill-muted-foreground text-xs"
            >
              {t("teamInvestment.copies")}
            </text>
            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                className="stroke-muted-foreground"
                strokeDasharray="2 2"
              />
            )}
            {series.map((entry) => (
              <g key={entry.slot} data-series={entry.characterId}>
                <path
                  d={entry.points
                    .map(
                      (point, index) =>
                        `${index ? "L" : "M"}${x(point.copies)},${y(point.percent)}`
                    )
                    .join(" ")}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={entry.dash}
                />
                {entry.points.map((point) => (
                  <circle
                    key={point.copies}
                    cx={x(point.copies)}
                    cy={y(point.percent)}
                    r={point.copies === active ? 6 : 4}
                    fill={entry.color}
                    className="stroke-card"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            ))}
          </svg>
          {active !== null && activeRows.length > 0 && (
            <div
              ref={tooltipRef}
              className="pointer-events-none absolute z-10 min-w-[11rem] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
              style={{ top: MARGIN.top, left: (anchor ?? 0) + 12 }}
              data-investment-tooltip
            >
              <div className="mb-1 font-medium">
                {t("teamInvestment.tooltip.copies", { count: active })}
              </div>
              <ul className="space-y-1">
                {activeRows.map(({ entry, point }) => (
                  <li key={entry.slot} className="flex items-center gap-1.5">
                    <LineKey color={entry.color} dash={entry.dash} />
                    <MemberAvatar
                      characterId={entry.characterId}
                      size="xs"
                      decorative
                    />
                    <span className="min-w-0 max-w-[7rem] truncate text-muted-foreground">
                      {entry.name}
                    </span>
                    <span className="font-mono">{stateLabel(point)}</span>
                    <span className="ml-auto pl-2 font-mono font-bold tabular-nums">
                      {percentLabel(point.percent, 1)}
                    </span>
                    {point.vsPrevious !== null && (
                      <span
                        className={cn(
                          "w-12 text-right font-mono tabular-nums",
                          point.vsPrevious < 0
                            ? "text-destructive"
                            : "text-primary"
                        )}
                      >
                        {signedPercent(point.vsPrevious, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <ul
        aria-label={t("teamInvestment.legend")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 text-xs"
      >
        {series.map((entry) => (
          <li key={entry.slot} className="flex min-w-0 items-center gap-1.5">
            <LineKey color={entry.color} dash={entry.dash} />
            <MemberAvatar
              characterId={entry.characterId}
              size="xs"
              decorative
            />
            <span className="max-w-[9rem] truncate font-semibold">
              {entry.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "+3.2%" / "−0.3%" for a fractional change. */
export function signedPercent(
  value: number,
  locale: Parameters<typeof formatPercent>[1]
): string {
  const formatted = formatPercent(Math.abs(value), locale);
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}
