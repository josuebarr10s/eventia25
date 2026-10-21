import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, renew, setAccess } from "./api";
import type { User } from "./types";
type AuthState = {
  user: User | null;
  loading: boolean;
  login: (
    kind: "login" | "register",
    values: Record<string, string>,
  ) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (await renew()) {
          const result = await api<User>("/users/me/");
          if (active) setUser(result);
        }
      } catch {
        setAccess(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function login(
    kind: "login" | "register",
    values: Record<string, string>,
  ) {
    const data = await api<{ access: string; user: User }>(`/auth/${kind}/`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    setAccess(data.access);
    setUser(data.user);
  }
  async function logout() {
    await api("/auth/logout/", { method: "POST" });
    setAccess(null);
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
