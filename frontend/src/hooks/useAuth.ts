import { useState, useCallback } from 'react';
import api from '../lib/api';
import { setAuth, clearAuth, getUser, isAuthenticated } from '../lib/auth';
import type { AuthUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getUser());

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    setAuth(res.data.token, res.data.user);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return { user, login, logout, isAuthenticated: isAuthenticated() };
}
