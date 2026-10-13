import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import FeedbackPage from "@/pages/FeedbackPage";
import SupportPage from "@/pages/SupportPage";
import {
  FEEDBACK_ENDPOINT,
  FeedbackError,
  submitFeedback,
} from "@/providers/community/feedback";

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: false,
  accountId: "synthetic-subject",
  signIn: vi.fn(async () => undefined),
  getFeedbackToken: vi.fn(async () => "synthetic-token"),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/providers/community/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/providers/community/client")>()),
  fetchPosts: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

function renderPage(page: React.ReactNode) {
  return render(
    <I18nProvider>
      <MemoryRouter>{page}</MemoryRouter>
    </I18nProvider>
  );
}
function fillFeedback() {
  fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
  fireEvent.change(screen.getByLabelText(/Suggestion \/ Experience/), {
    target: { value: "HSR suggestion" },
  });
}

describe("shared feedback client", () => {
  it("sends HSR feedback with a bearer token and no cross-origin cookies", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ nextAllowedAt: 123 }, { status: 201 })
    );
    await submitFeedback(
      {
        rating: 5,
        suggestion: "  HSR feedback  ",
        bugReport: "",
        contactMethod: " QQ 123 ",
      },
      async () => "synthetic-token",
      fetchImpl
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      FEEDBACK_ENDPOINT,
      expect.objectContaining({
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer synthetic-token",
        },
        body: JSON.stringify({
          game: "HSR",
          public: true,
          rating: 5,
          suggestion: "HSR feedback",
          contactMethod: "QQ 123",
        }),
      })
    );
  });

  it("does not send feedback when token acquisition fails", async () => {
    const fetchImpl = vi.fn();
    await expect(
      submitFeedback(
        { rating: 5, suggestion: "Feedback", bugReport: "", contactMethod: "" },
        async () => {
          throw new Error("Synthetic failure");
        },
        fetchImpl
      )
    ).rejects.toMatchObject({ kind: "signed-out" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 429, 503])(
    "reports recoverable server failures: %s",
    async (status) => {
      await expect(
        submitFeedback(
          {
            rating: 5,
            suggestion: "Feedback",
            bugReport: "",
            contactMethod: "",
          },
          async () => "synthetic-token",
          vi.fn(async () => Response.json({ retryAt: 123 }, { status }))
        )
      ).rejects.toEqual(
        new FeedbackError(
          status === 401
            ? "signed-out"
            : status === 429
              ? "rate-limited"
              : "unavailable",
          status === 429 ? 123 : null
        )
      );
    }
  );
});

describe("Star Rail feedback and support pages", () => {
  beforeEach(() => {
    auth.isAuthenticated = true;
    auth.signIn.mockClear();
    auth.getFeedbackToken.mockResolvedValue("synthetic-token");
  });

  it("gates feedback behind sign-in within the Star Rail site", async () => {
    auth.isAuthenticated = false;
    renderPage(<FeedbackPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      screen.getByRole("dialog", { name: "Sign in to send feedback" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalled());
  });

  it("validates fields, labels the game, submits, and clears the draft", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ nextAllowedAt: Date.now() + 300000 }, { status: 201 })
    );
    vi.stubGlobal("fetch", fetchImpl);
    renderPage(<FeedbackPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      screen.queryByText(/Game site: Honkai: Star Rail/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit feedback" })
    ).toBeDisabled();
    fillFeedback();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Hide from public feedback" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      await screen.findByText("Thanks, your feedback was sent.")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem("ggstarrail:feedback:draft:v1")).toBeNull()
    );
    expect(
      localStorage.getItem(
        "ggstarrail:feedback:synthetic-subject:next-allowed:v1"
      )
    ).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      FEEDBACK_ENDPOINT,
      expect.objectContaining({ body: expect.stringContaining('"game":"HSR"') })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      FEEDBACK_ENDPOINT,
      expect.objectContaining({
        body: expect.stringContaining('"public":false'),
      })
    );
    expect(Object.keys(localStorage).some((key) => key.includes("token"))).toBe(
      false
    );
  });

  it.each([1, 2])(
    "restores persisted draft version %s with a compatible visibility choice",
    (schemaVersion) => {
      localStorage.setItem(
        "ggstarrail:feedback:draft:v1",
        JSON.stringify({
          schemaVersion,
          rating: 4,
          suggestion: "Saved feedback",
          bugReport: "",
          contactMethod: "",
          ...(schemaVersion === 2 ? { hidden: true } : {}),
        })
      );
      renderPage(<FeedbackPage />);
      fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
      expect(screen.getByLabelText(/Suggestion \/ Experience/)).toHaveValue(
        "Saved feedback"
      );
      const checkbox = screen.getByRole("checkbox", {
        name: "Hide from public feedback",
      });
      if (schemaVersion === 2) expect(checkbox).toBeChecked();
      else expect(checkbox).not.toBeChecked();
    }
  );

  it("preserves the draft on failure and offers sign-in recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "unauthenticated" }, { status: 401 })
      )
    );
    renderPage(<FeedbackPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    fillFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      await screen.findByText("Your session has expired. Please sign in again.")
    ).toBeInTheDocument();
    expect(localStorage.getItem("ggstarrail:feedback:draft:v1")).toContain(
      "HSR suggestion"
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalled());
  });

  it("disables submission after the shared server cooldown response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "feedback_rate_limited", retryAt: Date.now() + 300000 },
          { status: 429 }
        )
      )
    );
    renderPage(<FeedbackPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    fillFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      await screen.findByText(
        "Please wait five minutes before sending more feedback."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit feedback" })
    ).toBeDisabled();
  });

  it("renders the same support content and image layout locally", () => {
    renderPage(<SupportPage />);
    expect(
      screen.getByRole("heading", { name: "Support GGArtifact" })
    ).toBeInTheDocument();
    expect(
      document.querySelector('img[src="/assets/support/imga.JPG"]')
    ).not.toBeNull();
    expect(
      document.querySelector('img[src="/assets/support/imgv.JPG"]')
    ).not.toBeNull();
  });
});
