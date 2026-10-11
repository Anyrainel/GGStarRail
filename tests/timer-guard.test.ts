import { expect, it, vi } from "vitest";
import { installTimerGuard } from "./timerGuard";

it("fails escaped timeouts and intervals with scheduling diagnostics and cancels them", async () => {
  const guard = installTimerGuard();
  const callback = vi.fn();
  try {
    setTimeout(callback, 60_000);
    setInterval(callback, 60_000);
    await expect(guard.verify()).rejects.toThrow(
      /2 timer\(s\) survived test cleanup/
    );
    expect(callback).not.toHaveBeenCalled();
    await expect(guard.verify()).resolves.toBeUndefined();
  } finally {
    guard.restore();
  }
});

it("accepts completed callbacks and cancellation through either clear API", async () => {
  const guard = installTimerGuard();
  const callback = vi.fn();
  try {
    clearInterval(setTimeout(callback, 60_000));
    clearTimeout(setInterval(callback, 60_000));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await expect(guard.verify()).resolves.toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
  } finally {
    guard.restore();
  }
});
