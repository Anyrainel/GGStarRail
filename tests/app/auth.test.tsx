import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { I18nProvider } from "@/i18n/I18nContext";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import { StarRailAuthStorage } from "@/providers/auth/client";
import {
  consumeAuthReturnPath,
  safeAuthReturnPath,
} from "@/services/auth/navigation";

const sdk = vi.hoisted(() => ({
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  getIdTokenClaims: vi.fn(async () => ({
    email: "trailblazer@example.test",
    sub: "synthetic-subject",
  })),
  getAccessToken: vi.fn(async () => "synthetic-access-token"),
  getIdToken: vi.fn(async () => "synthetic-id-token"),
  tokenReceived: vi.fn(),
  authenticated: false,
  callback: undefined as (() => void) | undefined,
  callbackError: undefined as Error | undefined,
}));
vi.mock("@/config/auth", () => ({
  AUTH_CONFIG: { endpoint: "https://auth.example.test", appId: "hsr-test-spa" },
  AUTH_CALLBACK_PATH: "/callback",
  AUTH_RETURN_KEY: "ggstarrail:auth:return-path:v1",
}));
vi.mock("@logto/react", () => ({
  LogtoProvider: ({ children }: { children: ReactNode }) => children,
  useLogto: () => ({
    isAuthenticated: sdk.authenticated,
    isLoading: false,
    getIdTokenClaims: sdk.getIdTokenClaims,
    getAccessToken: sdk.getAccessToken,
    getIdToken: sdk.getIdToken,
    signIn: sdk.signIn,
    signOut: sdk.signOut,
  }),
  useHandleSignInCallback: (callback: () => void) => {
    sdk.callback = callback;
    return { error: sdk.callbackError };
  },
}));

function AuthActions() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.label}</span>
      <button type="button" onClick={() => void auth.signIn()}>
        Login
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        Logout
      </button>
      <button
        type="button"
        onClick={() => void auth.getFeedbackToken().then(sdk.tokenReceived)}
      >
        Feedback token
      </button>
    </>
  );
}

describe("Star Rail website authentication", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sdk.authenticated = false;
    sdk.callbackError = undefined;
    sdk.signIn.mockClear();
    sdk.signOut.mockClear();
    window.history.replaceState(
      null,
      "",
      "/account-data/inventory?view=all#relics"
    );
  });

  it("uses the Star Rail callback and returns to the originating route", async () => {
    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText("Login"));
    await waitFor(() =>
      expect(sdk.signIn).toHaveBeenCalledWith(
        `${window.location.origin}/callback`
      )
    );
    expect(consumeAuthReturnPath()).toBe(
      "/account-data/inventory?view=all#relics"
    );
    expect(consumeAuthReturnPath()).toBe("/");
  });

  it("shows the identity on reload and signs out to this site's home", async () => {
    sdk.authenticated = true;
    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>
    );
    expect(
      await screen.findByText("trailblazer@example.test")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Logout"));
    await waitFor(() =>
      expect(sdk.signOut).toHaveBeenCalledWith(`${window.location.origin}/`)
    );
  });

  it("isolates SDK token storage from app data and other products", async () => {
    const storage = new StarRailAuthStorage("hsr-test-spa");
    await storage.setItem("idToken", "synthetic-token");
    expect(localStorage.getItem("ggstarrail:auth:hsr-test-spa:idToken")).toBe(
      "synthetic-token"
    );
    expect(await storage.getItem("idToken")).toBe("synthetic-token");
    await storage.setItem("signInSession", "synthetic-session");
    expect(
      sessionStorage.getItem("ggstarrail:auth:hsr-test-spa:signInSession")
    ).toBe("synthetic-session");
    await storage.removeItem("idToken");
    expect(await storage.getItem("idToken")).toBeNull();
  });

  it("refreshes the default token before acquiring the shared feedback ID token", async () => {
    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText("Feedback token"));
    await waitFor(() =>
      expect(sdk.tokenReceived).toHaveBeenCalledWith("synthetic-id-token")
    );
    expect(sdk.getAccessToken.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.getIdToken.mock.invocationCallOrder[0]!
    );
  });

  it.each([
    "https://evil.test/",
    "//evil.test/",
    "/callback?code=old",
    "https://[",
  ])("rejects unsafe return paths: %s", (path) => {
    expect(safeAuthReturnPath(path)).toBe("/");
  });

  it("routes a successful callback back to the saved page", () => {
    window.history.replaceState(
      null,
      "",
      "/callback?code=synthetic&state=synthetic"
    );
    sessionStorage.setItem(
      "ggstarrail:auth:return-path:v1",
      "/archive/characters"
    );
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/callback"]}>
          <Routes>
            <Route
              path="/callback"
              element={
                <>
                  <AuthCallbackPage />
                  <button type="button" onClick={() => sdk.callback?.()}>
                    Complete
                  </button>
                </>
              }
            />
            <Route
              path="/archive/characters"
              element={<p>Returned to archive</p>}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
    fireEvent.click(screen.getByText("Complete"));
    expect(screen.getByText("Returned to archive")).toBeInTheDocument();
  });

  it("offers recovery on malformed callback URLs", () => {
    window.history.replaceState(null, "", "/callback");
    render(
      <I18nProvider>
        <MemoryRouter>
          <AuthCallbackPage />
        </MemoryRouter>
      </I18nProvider>
    );
    expect(
      screen.getByText("Sign-in failed. Please return and try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});
