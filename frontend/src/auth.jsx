import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    let cancelled = false;
    api
      .get('/auth/me')
      .then((d) => !cancelled && setUser(d.user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const d = await api.post('/auth/google', { credential });
    setUser(d.user);
    return d.user;
  }, []);

  const loginWithPassword = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setUser(d.user);
    return d.user;
  }, []);

  const registerWithPassword = useCallback(async (name, email, password) => {
    const d = await api.post('/auth/register', { name, email, password });
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    return api.post('/auth/forgot-password', { email });
  }, []);

  const resetPasswordWithToken = useCallback(async (token, password) => {
    const d = await api.post('/auth/reset-password', { token, password });
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: loginWithGoogle, // backward-compatibility
      loginWithGoogle,
      loginWithPassword,
      registerWithPassword,
      requestPasswordReset,
      resetPasswordWithToken,
      logout,
      isAuthor: user?.role === 'author',
    }),
    [user, loading, loginWithGoogle, loginWithPassword, registerWithPassword, requestPasswordReset, resetPasswordWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
