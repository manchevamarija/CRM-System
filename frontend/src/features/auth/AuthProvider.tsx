import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, setAccessToken } from "../../api";
import { AuthContext } from "./auth-context";
import type { AuthValue, PortalUser } from "./auth-context";
type Session = { accessToken: string; user: PortalUser };

function cachedUser() {
  try {
    const value = sessionStorage.getItem("crm-system.user");
    return value ? (JSON.parse(value) as PortalUser) : null;
  } catch {
    sessionStorage.removeItem("crm-system.user");
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<PortalUser>("/api/auth/me")
      .then((currentUser) => {
        if (!active) return;
        sessionStorage.setItem("crm-system.user", JSON.stringify(currentUser));
        setUser(currentUser);
      })
      .catch((error) => {
        if (!active) return;
        if (
          error instanceof ApiError &&
          (error.status === 0 || error.status >= 500)
        ) {
          setUser(cachedUser());
          return;
        }
        setAccessToken(null);
        sessionStorage.removeItem("crm-system.user");
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login: async (email, password) => {
        const session = await api<Session>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAccessToken(session.accessToken);
        sessionStorage.setItem("crm-system.user", JSON.stringify(session.user));
        setUser(session.user);
        return session.user;
      },
      logout: async () => {
        await api("/api/auth/logout", {
          method: "POST",
          skipRefresh: true,
        }).catch(() => undefined);
        setAccessToken(null);
        sessionStorage.removeItem("crm-system.user");
        setUser(null);
      },
    }),
    [user, isLoading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
