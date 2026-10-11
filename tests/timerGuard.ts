/** Keep real-time UI tests, but attribute escaped callbacks to their owning test. */
export function installTimerGuard() {
  const nativeTimeout = globalThis.setTimeout;
  const nativeInterval = globalThis.setInterval;
  const nativeClearTimeout = globalThis.clearTimeout;
  const nativeClearInterval = globalThis.clearInterval;
  const pending = new Map<ReturnType<typeof setTimeout>, Error>();

  globalThis.setTimeout = ((
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ) => {
    const origin = new Error(
      `Timeout (${delay ?? 0} ms) survived test cleanup`
    );
    const handle = nativeTimeout(() => {
      pending.delete(handle);
      callback(...args);
    }, delay);
    pending.set(handle, origin);
    return handle;
  }) as typeof setTimeout;
  globalThis.setInterval = ((
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ) => {
    const handle = nativeInterval(callback, delay, ...args);
    pending.set(
      handle,
      new Error(`Interval (${delay ?? 0} ms) survived test cleanup`)
    );
    return handle;
  }) as typeof setInterval;
  globalThis.clearTimeout = (handle) => {
    if (handle != null) pending.delete(handle as ReturnType<typeof setTimeout>);
    nativeClearTimeout(handle);
  };
  globalThis.clearInterval = (handle) => {
    if (handle != null) pending.delete(handle as ReturnType<typeof setTimeout>);
    nativeClearInterval(handle);
  };

  const verify = async () => {
    // Radix focus restoration and animation-frame cleanup finish on the next turn.
    await new Promise((resolve) => nativeTimeout(resolve, 25));
    const leaks = [...pending.values()];
    for (const handle of pending.keys()) nativeClearTimeout(handle);
    pending.clear();
    if (leaks.length) {
      throw new AggregateError(
        leaks,
        `${leaks.length} timer(s) survived test cleanup:\n${leaks.map((error) => error.stack).join("\n\n")}`
      );
    }
  };
  const restore = () => {
    globalThis.setTimeout = nativeTimeout;
    globalThis.setInterval = nativeInterval;
    globalThis.clearTimeout = nativeClearTimeout;
    globalThis.clearInterval = nativeClearInterval;
  };
  return { verify, restore };
}
