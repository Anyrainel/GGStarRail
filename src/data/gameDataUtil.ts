type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Revision metadata lives in the manifest so unchanged content keeps its URL. */
export function restoreSourceRevision(
  value: unknown,
  revision: string
): unknown {
  if (Array.isArray(value))
    return value.map((entry) => restoreSourceRevision(entry, revision));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "source_revision" && entry === "$source_revision"
        ? revision
        : restoreSourceRevision(entry, revision),
    ])
  );
}

/** Text pointers are scoped to one partition, before released/beta merging. */
export function restoreLocalizedText(
  value: unknown,
  en: JsonObject,
  zh: JsonObject
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => restoreLocalizedText(entry, en, zh));
  }
  if (!isObject(value)) return value;
  if ("$text" in value) {
    const pointer = value.$text;
    if (
      typeof pointer !== "string" ||
      !Object.hasOwn(en, pointer) ||
      !Object.hasOwn(zh, pointer)
    ) {
      throw new Error(`Missing localized game text: ${String(pointer)}`);
    }
    return { en: en[pointer], "zh-CN": zh[pointer] };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      restoreLocalizedText(entry, en, zh),
    ])
  );
}

/** Released entities replace their complete beta counterpart on promotion. */
export function mergeReleasedData(released: unknown, beta: unknown): unknown {
  if (Array.isArray(released) && Array.isArray(beta)) {
    if (released.length === 0) return beta;
    const identity = ["id", "character_id"].find((key) =>
      [...released, ...beta].every((entry) => isObject(entry) && key in entry)
    );
    if (!identity) return released;
    const releasedIds = new Set(released.map((entry) => entry[identity]));
    return [
      ...released,
      ...beta.filter((entry) => !releasedIds.has(entry[identity])),
    ];
  }
  if (isObject(released) && isObject(beta)) {
    return Object.fromEntries(
      [...new Set([...Object.keys(beta), ...Object.keys(released)])].map(
        (key) => [
          key,
          Object.hasOwn(released, key)
            ? Object.hasOwn(beta, key)
              ? mergeReleasedData(released[key], beta[key])
              : released[key]
            : beta[key],
        ]
      )
    );
  }
  return released;
}

/** A released base character does not establish release of its enhancements. */
export function mergeBetaCharacterEnhancements(
  merged: unknown,
  beta: unknown
): unknown {
  if (
    !isObject(merged) ||
    !isObject(beta) ||
    !Array.isArray(merged.value) ||
    !Array.isArray(beta.value)
  ) {
    throw new Error("Invalid character enhancement overlay");
  }
  const betaById = new Map(
    beta.value.filter(isObject).map((entry) => [entry.id, entry])
  );
  return {
    ...merged,
    value: merged.value.map((entry: unknown) => {
      if (!isObject(entry)) throw new Error("Invalid character record");
      const extra = betaById.get(entry.id);
      if (
        !Array.isArray(entry.enhancements) ||
        entry.enhancements.length > 0 ||
        !Array.isArray(extra?.enhancements)
      )
        return entry;
      return { ...entry, enhancements: extra.enhancements };
    }),
  };
}
