import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'student' | 'instructor' | 'admin';
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name: string }) => Promise<void>;
  logout: () => void;
  updateUser: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('access_token');
    if (token) {
      authAPI.getMe()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authAPI.login({ username, password });
    Cookies.set('access_token', res.data.access_token, { expires: 1 });
    Cookies.set('refresh_token', res.data.refresh_token, { expires: 30 });
    setUser(res.data.user);
  };

  const register = async (data: { username: string; email: string; password: string; full_name: string }) => {
    const res = await authAPI.register(data);
    Cookies.set('access_token', res.data.access_token, { expires: 1 });
    Cookies.set('refresh_token', res.data.refresh_token, { expires: 30 });
    setUser(res.data.user);
  };

  const logout = () => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    setUser(null);
    window.location.href = '/login';
  };

  const updateUser = async (data: any) => {
    const res = await authAPI.updateMe(data);
    setUser(res.data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
