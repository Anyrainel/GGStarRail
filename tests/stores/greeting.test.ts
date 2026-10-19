import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { useGreetingStore } from "@/stores/useGreetingStore";

describe("greeting preferences", () => {
  it("hydrates versioned browser-local preferences without changing game workspace data", async () => {
    localStorage.setItem(
      STORAGE_KEYS.greeting,
      JSON.stringify({
        version: 1,
        state: { buildPromptSeen: true, lastSeenUpdate: "2026-10-10" },
      })
    );
    await useGreetingStore.persist.rehydrate();
    expect(useGreetingStore.getState()).toMatchObject({
      buildPromptSeen: true,
      lastSeenUpdate: "2026-10-10",
    });
    useGreetingStore.getState().dismissUpdate("2026-10-19");
    useGreetingStore.getState().dismissUpdate("2026-10-10");
    useGreetingStore.getState().dismissBuildPrompt("2026-10-10");
    expect(useGreetingStore.getState().lastSeenUpdate).toBe("2026-10-19");
  });

  it("rejects corrupt saved preferences through hydration", async () => {
    useGreetingStore.setState({ buildPromptSeen: false, lastSeenUpdate: null });
    localStorage.setItem(
      STORAGE_KEYS.greeting,
      JSON.stringify({
        version: 1,
        state: { buildPromptSeen: "yes", lastSeenUpdate: "invalid" },
      })
    );
    await useGreetingStore.persist.rehydrate();
    expect(useGreetingStore.getState()).toMatchObject({
      buildPromptSeen: false,
      lastSeenUpdate: null,
    });
  });
});
