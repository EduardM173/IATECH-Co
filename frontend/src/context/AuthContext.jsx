import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./auth-context";
import { currentSession, closeSession } from "../lib/api";
const STORAGE_KEY = "iatech.session";
function stored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
export function AuthProvider({ children }) {
  const [session, setSession] = useState(stored);
  const [loading, setLoading] = useState(() => Boolean(stored()?.user));
  useEffect(() => {
    if (!stored()?.user) return;
    let active = true;
    currentSession(stored()?.token)
      .then(({ user }) => {
        if (active) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
          setSession({ user });
        }
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
        }
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
        setSession({ user });
      },
      logout() {
        closeSession().catch(() => {});
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
