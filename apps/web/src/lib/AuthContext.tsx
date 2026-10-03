"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for existing session
    const storedToken = localStorage.getItem("qd_token");
    const storedUser = localStorage.getItem("qd_user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else if (pathname !== "/login") {
      router.push("/login");
    }
    
    setIsLoading(false);
  }, [pathname, router]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("qd_token", newToken);
    localStorage.setItem("qd_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    router.push("/");
  };

  const logout = () => {
    localStorage.removeItem("qd_token");
    localStorage.removeItem("qd_user");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
