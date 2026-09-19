import { formatGameText } from "@/lib/gameText";

/** Apply every variant to the same authored template without inferring prose. */
export function formatGameTextVariants(
  template: string,
  levels: readonly { parameters: readonly number[] }[],
  trailblazer: string
): string {
  return formatGameText(template, [], trailblazer).replace(
    /#\d+(?:\[[^\]]+\])?%?/g,
    (token) => {
      const values = levels.map((level) =>
        formatGameText(token, level.parameters)
      );
      if (values.some((value) => value === token))
        throw new Error("Game text variant parameter is missing");
      if (values.every((value) => value === values[0])) return values[0] ?? "";
      const percent = values.every((value) => value.endsWith("%"));
      return `${values.map((value) => (percent ? value.slice(0, -1) : value)).join("/")}${percent ? "%" : ""}`;
    }
  );
}
