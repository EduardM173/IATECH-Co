import { useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "./auth-context";
import { currentSession, closeSession } from "../lib/api";
import { centralOrigin } from "../lib/auth-navigation";
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutStarted = useRef(false);
  useEffect(() => {
    localStorage.removeItem("iatech.session");
    let active = true;
    currentSession()
      .then(({ user }) => {
        if (active) setSession({ user });
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.user),
      loading,
      login(user) {
        setSession({ user });
      },
      async logout() {
        if (logoutStarted.current) return;
        logoutStarted.current = true;
        try {
          await closeSession();
          window.location.replace(new URL("/login", centralOrigin()).href);
        } catch {
          window.location.replace(new URL("/logout", centralOrigin()).href);
        }
      },
    }),
    [session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
