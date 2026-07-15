import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api, apiErrorMessage } from "../api/client";
import type { User } from "../api/types";

export interface UpdateMeInput {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, rosterNameId: string, residencyYear?: number) => Promise<string>;
  updateMe: (input: UpdateMeInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, rosterNameId: string, residencyYear?: number) => {
      setLoading(true);
      try {
        const { data } = await api.post("/auth/register", { email, password, rosterNameId, residencyYear });
        // El registro ya no inicia sesión: la cuenta queda pendiente de que un admin la active.
        return data.message as string;
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateMe = useCallback(async (input: UpdateMeInput) => {
    setLoading(true);
    try {
      const { data } = await api.patch("/auth/me", input);
      const nextUser = { ...data };
      localStorage.setItem("user", JSON.stringify(nextUser));
      setUser(nextUser);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
