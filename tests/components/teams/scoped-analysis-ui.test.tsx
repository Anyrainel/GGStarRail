import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChoiceRun } from "@/components/teams/choice/useChoiceRun";
import { emptyTeam } from "@/domain/team/schemas";
import { clearResultCache } from "@/services/combat/resultCache";

describe("cached team analysis owners", () => {
  it("stops one team's comparison while another finishes and releases its worker", async () => {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      posted: { id: number }[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
      postMessage(message: { id: number }) {
        this.posted.push(message);
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    const sources = { account: null, builds: [], characterLightConeIds: {} };
    const member = { slot: 0, characterId: "1102" };
    const first = renderHook(() =>
      useChoiceRun(emptyTeam("first-owned-run"), sources, [member], "realistic")
    );
    const second = renderHook(() =>
      useChoiceRun(
        emptyTeam("second-owned-run"),
        sources,
        [member],
        "realistic"
      )
    );
    try {
      expect(workers).toHaveLength(0);
      act(() => {
        first.result.current.run("lightCones");
        second.result.current.run("lightCones");
      });
      expect(workers).toHaveLength(2);
      act(() => first.result.current.stop());
      expect(workers[0].terminate).toHaveBeenCalled();
      expect(workers[1].terminate).not.toHaveBeenCalled();
      const rows = [
        {
          lightCone: { id: "23001", superimposition: 2 },
          damage: 1000,
          relative: 1,
        },
      ];
      act(() =>
        workers[1].onmessage?.(
          new MessageEvent("message", {
            data: { id: workers[1].posted[0].id, result: rows },
          })
        )
      );
      await waitFor(() => expect(second.result.current.running).toBe(false));
      expect(
        second.result.current.resultFor("lightCones")?.rankings[0]
      ).toEqual(rows);
      expect(workers[1].terminate).toHaveBeenCalled();
      act(() =>
        workers[0].onmessage?.(
          new MessageEvent("message", {
            data: { id: workers[0].posted[0].id, result: rows },
          })
        )
      );
      expect(first.result.current.resultFor("lightCones")).toBeNull();
    } finally {
      first.unmount();
      second.unmount();
      vi.unstubAllGlobals();
      clearResultCache();
    }
  });
});
