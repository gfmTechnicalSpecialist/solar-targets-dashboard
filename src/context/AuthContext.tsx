import React, { createContext, useContext, useEffect, useState } from 'react';

const HIGECO_GRAPHQL = '/api/graphql';
const LOGIN_MUTATION = 'mutation ($v: Credentials) { req_0: login(credentials: $v) }';

interface User {
  username: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  sessionError: string | null;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  clearSessionError: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  sessionError: null,
  signIn: async () => ({ success: false }),
  clearSessionError: () => {},
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('solar-dashboard-user');
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('solar-dashboard-user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('solar-dashboard-user');
    }
  }, [user]);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setUser(null);
      setSessionError(detail?.message || 'Your session expired. Please sign in again.');
    };

    window.addEventListener('solar-dashboard:session-expired', handleSessionExpired);
    return () => window.removeEventListener('solar-dashboard:session-expired', handleSessionExpired);
  }, []);

  const signIn = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setSessionError(null);
      const res = await fetch(HIGECO_GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: LOGIN_MUTATION,
          variables: { v: { u: username, p: password } },
        }),
      });

      if (!res.ok) {
        return { success: false, error: 'Server error. Please try again.' };
      }

      const json = await res.json();

      if (json.errors?.length) {
        const msg = json.errors[0]?.message;
        if (msg === 'InvalidCredentials') {
          return { success: false, error: 'Invalid username or password.' };
        }
        return { success: false, error: msg || 'Login failed.' };
      }

      const token = json.data?.req_0;
      if (token) {
        setSessionError(null);
        setUser({ username, token });
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from server.' };
    } catch {
      return { success: false, error: 'Unable to reach the server. Check your connection.' };
    }
  };

  const clearSessionError = () => setSessionError(null);

  const signOut = () => {
    setSessionError(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, sessionError, signIn, clearSessionError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
