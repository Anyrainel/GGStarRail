import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicPosts } from "@/components/shared/PublicPosts";
import { I18nProvider } from "@/i18n/I18nContext";

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  accountId: "author",
  getFeedbackToken: async () => "synthetic-token",
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
describe("Signed-in feedback", () => {
  it("authenticates reads and actions, then removes private content on logout", async () => {
    const post = {
      id: "mine",
      createdAt: 1,
      suggestion: "My private feedback",
      isPublic: false,
      isOwner: true,
      authorEmail: "t***r@e***e.com",
      upvotes: 1,
      hasUpvoted: true,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [post], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({ ...post, isPublic: true }))
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetcher);
    const view = render(
      <I18nProvider>
        <PublicPosts />
      </I18nProvider>
    );
    expect(await screen.findByText("My private feedback")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("game=HSR"),
      expect.objectContaining({
        credentials: "omit",
        headers: { Authorization: "Bearer synthetic-token" },
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Make public" }));
    expect(
      await screen.findByRole("button", { name: "Hide from public feedback" })
    ).toBeEnabled();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/mine/visibility"),
      expect.objectContaining({
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer synthetic-token",
        },
        body: '{"public":true}',
      })
    );
    auth.isAuthenticated = false;
    view.rerender(
      <I18nProvider>
        <PublicPosts />
      </I18nProvider>
    );
    expect(screen.queryByText("My private feedback")).toBeNull();
    await waitFor(() =>
      expect(screen.getByText("No posts yet.")).toBeInTheDocument()
    );
    expect(fetcher.mock.calls[2][1]).not.toHaveProperty("headers");
  });
});
