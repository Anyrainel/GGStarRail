function formatParameter(value: number, percent: boolean): string {
  const displayValue = percent ? value * 100 : value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(displayValue);
}

function formatChoiceTokens(source: string): string {
  return source
    .replace(
      /\{F#([^{}]*)\}\{M#([^{}]*)\}/g,
      (_token, female: string, male: string) => `${female}/${male}`
    )
    .replace(/\{[FM]#([^{}]*)\}/g, "$1");
}

function decodeGameMarkupEntities(source: string): string {
  return source
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function formatGameText(
  source: string,
  parameters: readonly number[] = [],
  trailblazerFallback?: string
): string {
  return formatChoiceTokens(decodeGameMarkupEntities(source))
    .replace(/\{RUBY_B#[^{}]*\}/g, "")
    .replace(/\{RUBY_E#\}/g, "")
    .replace(
      /\{NICKNAME\}/g,
      trailblazerFallback === undefined ? "{NICKNAME}" : trailblazerFallback
    )
    .replace(/\\n/g, "\n")
    .replace(
      /#(\d+)\[[^\]]+\](%?)/g,
      (token, sourceIndex: string, percentMarker: string) => {
        const parameter = parameters[Number(sourceIndex) - 1];
        if (parameter === undefined) return token;
        const percent = percentMarker === "%";
        return `${formatParameter(parameter, percent)}${percentMarker}`;
      }
    )
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatCatalogValue(
  value: number,
  valueKind: "flat" | "ratio" | "unknown"
): string {
  if (valueKind === "ratio") {
    return `${formatParameter(value, true)}%`;
  }
  return formatParameter(value, false);
}
