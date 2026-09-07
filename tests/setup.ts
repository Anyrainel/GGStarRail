import "@testing-library/jest-dom/vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = vi.fn();
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = vi.fn();
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = vi.fn();
}

function installFixtureTransport() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      // Exercise the production fetch/reconstruction path against the actual
      // published fixture files; every other request remains forbidden.
      const match =
        /^\/src\/data\/game\/([a-z_]+\.json(?:\.gz)?)(?:\?.*)?$/.exec(url);
      if (!match) throw new Error(`Unexpected network access in test: ${url}`);
      const bytes = await readFile(path.resolve("src/data/game", match[1]));
      return new Response(bytes);
    })
  );
}

beforeAll(installFixtureTransport);

beforeEach(() => {
  localStorage.clear();
  installFixtureTransport();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
