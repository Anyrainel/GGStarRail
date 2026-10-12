const SENSITIVE_FIELD =
  /(authorization|cookie|ltoken|ltuid|ltmid|token|secret|session)/i;

export function assertNoSensitiveFields(value: unknown, path = "$root"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoSensitiveFields(entry, `${path}[${index}]`);
    });
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_FIELD.test(key)) {
      throw new Error(`Sensitive field is not allowed at ${path}.${key}`);
    }
    assertNoSensitiveFields(entry, `${path}.${key}`);
  }
}

export function redactDiagnostic(value: unknown): string {
  const source =
    value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  return source
    .replace(
      /\b(authorization|cookie|set-cookie|ltoken|ltuid|ltmid|token|secret|session)\b\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]"
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]"
    )
    .replace(/\b[A-Fa-f0-9]{40,}\b/g, "[REDACTED_VALUE]");
}
