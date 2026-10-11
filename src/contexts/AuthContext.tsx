import { LogtoProvider, useLogto } from "@logto/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { AUTH_CALLBACK_PATH, AUTH_CONFIG } from "@/config/auth";
import { StarRailAuthClient } from "@/lib/authClient";
import { rememberAuthReturnPath } from "@/lib/authNavigation";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  label: string | null;
  error: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const unavailable: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  label: null,
  error: false,
  signIn: async () => {
    throw new Error("AUTH_NOT_CONFIGURED");
  },
  signOut: async () => {
    throw new Error("AUTH_NOT_CONFIGURED");
  },
};
const AuthContext = createContext<AuthState>(unavailable);

function ConnectedAuthProvider({ children }: { children: ReactNode }) {
  const auth = useLogto();
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLabel(null);
    if (auth.isAuthenticated) {
      void auth
        .getIdTokenClaims()
        .then((claims) => {
          if (active) setLabel(claims?.email ?? claims?.name ?? null);
        })
        .catch(() => {
          /* The menu can still display its localized fallback. */
        });
    }
    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, auth.getIdTokenClaims]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        label,
        error: Boolean(auth.error),
        signIn: async () => {
          rememberAuthReturnPath();
          await auth.signIn(
            new URL(AUTH_CALLBACK_PATH, window.location.origin).href
          );
        },
        signOut: async () => {
          await auth.signOut(new URL("/", window.location.origin).href);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <LogtoProvider config={AUTH_CONFIG} LogtoClientClass={StarRailAuthClient}>
      <ConnectedAuthProvider>{children}</ConnectedAuthProvider>
    </LogtoProvider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
