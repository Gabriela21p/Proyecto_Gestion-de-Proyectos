'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { loginAccount, registerAccount, getCurrentUser, getSession, saveSession, clearSession } from './auth';
import { installPostal472FetchInterceptor } from './postal472FetchInterceptor';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    installPostal472FetchInterceptor();
    let isMounted = true;

    async function initSession() {
      const { token: savedToken, user: savedUser } = getSession();
      if (savedToken && savedUser) {
        if (!isMounted) return;
        setToken(savedToken);
        setUser(savedUser);
        await verifyToken(savedToken);
      }
      if (isMounted) setLoading(false);
    }

    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const currentUser = await getCurrentUser(tokenToVerify);
      if (currentUser) {
        setUser(currentUser);
      } else {
        clearSession();
        setUser(null);
        setToken(null);
      }
    } catch {
      clearSession();
      setUser(null);
      setToken(null);
    }
  };

  const login = async (email, password) => {
    const result = await loginAccount(email, password);
    setUser(result.user);
    setToken(result.token);
    saveSession(result.token, result.user);
    return result;
  };

  const register = async (username, email, password) => {
    const result = await registerAccount(username, email, password);
    setUser(result.user);
    setToken(result.token);
    saveSession(result.token, result.user);
    return result;
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
