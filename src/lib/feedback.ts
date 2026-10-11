export const FEEDBACK_TEXT_LIMIT = 1000;
export const FEEDBACK_CONTACT_LIMIT = 200;
export const FEEDBACK_ENDPOINT = new URL(
  "/api/feedback/v1/submissions",
  import.meta.env.VITE_FEEDBACK_API_ORIGIN || "https://ggartifact.com"
).href;

export interface FeedbackInput {
  rating: number;
  suggestion: string;
  bugReport: string;
  contactMethod: string;
}

export class FeedbackError extends Error {
  constructor(
    readonly kind: "signed-out" | "rate-limited" | "unavailable",
    readonly retryAt: number | null = null
  ) {
    super(kind);
  }
}

export async function submitFeedback(
  input: FeedbackInput,
  getToken: () => Promise<string>,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<{ nextAllowedAt: number }> {
  let token: string;
  try {
    token = await getToken();
  } catch {
    throw new FeedbackError("signed-out");
  }
  if (!token) throw new FeedbackError("signed-out");
  let response: Response;
  try {
    response = await fetchImpl(FEEDBACK_ENDPOINT, {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game: "HSR",
        public: true,
        rating: input.rating,
        suggestion: input.suggestion.trim() || undefined,
        bugReport: input.bugReport.trim() || undefined,
        contactMethod: input.contactMethod.trim() || undefined,
      }),
    });
  } catch {
    throw new FeedbackError("unavailable");
  }
  if (response.status === 401) throw new FeedbackError("signed-out");
  const payload: unknown = await response.json().catch(() => null);
  if (
    response.status === 429 &&
    payload &&
    typeof payload === "object" &&
    "retryAt" in payload &&
    typeof payload.retryAt === "number" &&
    Number.isFinite(payload.retryAt)
  ) {
    throw new FeedbackError("rate-limited", payload.retryAt);
  }
  if (
    !response.ok ||
    !payload ||
    typeof payload !== "object" ||
    !("nextAllowedAt" in payload) ||
    typeof payload.nextAllowedAt !== "number" ||
    !Number.isFinite(payload.nextAllowedAt)
  ) {
    throw new FeedbackError("unavailable");
  }
  return { nextAllowedAt: payload.nextAllowedAt };
}
