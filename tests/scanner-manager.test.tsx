import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScannerManagerConnection } from "@/components/account-data/ScannerManagerConnection";
import { I18nProvider } from "@/i18n/I18nContext";
import { ManagerInstructionEnvelopeSchema } from "@/lib/managerInstructions";
import { ScannerManagerClient } from "@/lib/scannerManager";

const idle = {
  game: "star-rail",
  jobId: null,
  kind: null,
  phase: "idle",
  count: 0,
  progress: {
    message: { zh: "等待网站请求", en: "Waiting for a website request" },
    steps: [],
  },
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
afterEach(() => vi.unstubAllGlobals());

describe("scanner manager connection", () => {
  it("submits only after Apply, polls the same job and returns verified results once", async () => {
    const envelope = ManagerInstructionEnvelopeSchema.parse(
      JSON.parse(
        readFileSync(
          "tests/fixtures/scanner/manager-instructions-v1.json",
          "utf8"
        )
      )
    );
    let applied = false;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/manage") && init?.method === "POST") {
        applied = true;
        return Promise.resolve(response({ game: "star-rail", jobId: "job-1" }));
      }
      if (url.includes("/result?"))
        return Promise.resolve(
          response({
            jobId: "job-1",
            kind: "manage",
            verified: 1,
            needsReview: 0,
            skipped: 0,
            total: 1,
            entries: [],
            instructions: [],
          })
        );
      return Promise.resolve(
        response(
          applied
            ? { ...idle, kind: "manage", jobId: "job-1", phase: "completed" }
            : idle
        )
      );
    });
    vi.stubGlobal("fetch", fetch);
    const onResult = vi.fn((_result: unknown, _submitted: unknown) => true);
    render(
      <I18nProvider>
        <ScannerManagerConnection envelope={envelope} onResult={onResult} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /^(Connect|连接)$/ }));
    const apply = screen.getByRole("button", {
      name: /^(Apply to game|应用到游戏)$/,
    });
    await waitFor(() => expect(apply).toBeEnabled());
    expect(applied).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(onResult).toHaveBeenCalledOnce(), {
      timeout: 3000,
    });
    const posts = fetch.mock.calls.filter(
      ([, init]) => init?.method === "POST"
    );
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual(envelope);
    expect(onResult.mock.calls[0][0]).toMatchObject({
      jobId: "job-1",
      verified: 1,
    });
  });
  it("rejects the other game's manager before submitting anything", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ ...idle, game: "genshin" }));
    vi.stubGlobal("fetch", fetch);
    await expect(new ScannerManagerClient(8765).status()).rejects.toMatchObject(
      { code: "wrong-game" }
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
  });

  it("keeps job identity and bilingual errors when reading a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          jobId: "job-1",
          error: {
            zh: "请切回游戏",
            en: "Switch back to the game",
            details: "FOCUS_LOST",
          },
        })
      )
    );
    await expect(
      new ScannerManagerClient(8765).result("job-1")
    ).rejects.toMatchObject({
      code: "operation",
      feedback: { en: "Switch back to the game", details: "FOCUS_LOST" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          jobId: "other",
          kind: "manage",
          verified: 1,
          skipped: 0,
          needsReview: 0,
          total: 1,
          instructions: [],
        })
      )
    );
    await expect(
      new ScannerManagerClient(8765).result("job-1")
    ).rejects.toMatchObject({ code: "response" });
  });

  it("shows disconnected guidance by the action without sending instructions", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("network"));
    vi.stubGlobal("fetch", fetch);
    render(
      <I18nProvider>
        <ScannerManagerConnection envelope={null} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /^(Connect|连接)$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Start the Star Rail manager|星铁管理器/
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reconnects to a completed task and prominently shows manual review and skipped reasons", async () => {
    const status = {
      ...idle,
      jobId: "job-1",
      kind: "manage",
      phase: "completed",
      count: 3,
      progress: {
        message: { zh: "操作结束", en: "Operation finished" },
        steps: [
          {
            key: "lock",
            zh: "锁定",
            en: "Lock",
            completed: 1,
            total: 2,
            state: "interrupted",
          },
        ],
      },
    };
    const fetch = vi.fn((url: string, _init?: RequestInit) =>
      Promise.resolve(
        response(
          url.includes("/result?")
            ? {
                jobId: "job-1",
                kind: "manage",
                verified: 1,
                skipped: 1,
                needsReview: 1,
                total: 2,
                entries: [],
                instructions: [{ classification: "previewOnlyNotFound" }],
              }
            : status
        )
      )
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <I18nProvider>
        <ScannerManagerConnection envelope={null} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /^(Connect|连接)$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/1 verified|已验证 1/)
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
    expect(screen.getByText(/No matching Relic|未找到匹配遗器/)).toBeVisible();
    expect(
      fetch.mock.calls.every(
        ([, init]) =>
          init === undefined || (init as RequestInit).method !== "POST"
      )
    ).toBe(true);
  });
});
