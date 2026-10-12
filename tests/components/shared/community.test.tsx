import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicPosts } from "@/components/shared/PublicPosts";
import { I18nProvider } from "@/i18n/I18nContext";
import { submitComment } from "@/providers/community/client";

describe("Public posts", () => {
  it("renders without waiting, retries failed reads, and sends no auth for browsing", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "1", createdAt: 1, body: "Player comment" }],
          nextCursor: null,
        })
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <I18nProvider>
        <PublicPosts characterId="1001" />
      </I18nProvider>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading posts");
    await act(async () => {
      finish(Response.json({}, { status: 503 }));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Player comment")).toBeInTheDocument();
    expect(fetcher.mock.calls[0][0]).toContain(
      "/characters/1001/comments?game=HSR"
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("headers");
  });
  it("uses the shared bearer identity only for posting and preserves recoverable errors", async () => {
    const fetcher = vi.fn(async () => Response.json({}, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      submitComment("1001", "  Hello  ", async () => "synthetic-token")
    ).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("game=HSR"),
      expect.objectContaining({
        credentials: "omit",
        body: JSON.stringify({ body: "Hello" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer synthetic-token",
        },
      })
    );
    fetcher.mockClear();
    await expect(
      submitComment("1001", "Hello", async () => {
        throw new Error("Expired");
      })
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
