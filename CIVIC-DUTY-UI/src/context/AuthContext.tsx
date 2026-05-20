import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, apiLogin, apiRegister, apiMe } from '../api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem('cd_token');
    if (!token) {
      setLoading(false);
      return;
    }
    apiMe()
      .then(setUser)
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('cd_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await apiLogin(email, password);
    localStorage.setItem('cd_token', token);
    setUser(user);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const { token, user } = await apiRegister(email, password, displayName);
    localStorage.setItem('cd_token', token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('cd_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
