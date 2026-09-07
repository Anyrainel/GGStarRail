import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import {
  betaEnabled,
  maybeHandleBetaMagic,
  setBetaEnabled,
} from "@/data/betaState";

describe("unreleased content opt-in", () => {
  it("accepts the archive shortcuts and reloads with the persisted setting", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    expect(maybeHandleBetaMagic("开启测试模式")).toBe(true);
    expect(betaEnabled()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(maybeHandleBetaMagic("开启测试模式")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(maybeHandleBetaMagic("关闭测试模式")).toBe(true);
    expect(betaEnabled()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });
  it("defaults off and ignores other applications' preferences", () => {
    localStorage.setItem("enable-beta", "true");
    expect(betaEnabled()).toBe(false);
  });

  it("persists the explicit selection and can disable it", () => {
    setBetaEnabled(true);
    expect(betaEnabled()).toBe(true);
    setBetaEnabled(false);
    expect(betaEnabled()).toBe(false);
  });

  it("fails closed on malformed preferences", () => {
    localStorage.setItem(STORAGE_KEYS.beta, '{"enabled":true}');
    expect(betaEnabled()).toBe(false);
  });

  it("leaves ordinary searches untouched", () => {
    expect(maybeHandleBetaMagic("三月七")).toBe(false);
    expect(betaEnabled()).toBe(false);
  });
});
