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
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  signIn: async () => ({ success: false }),
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

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('solar-dashboard-user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('solar-dashboard-user');
    }
  }, [user]);

  const signIn = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
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
        setUser({ username, token });
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from server.' };
    } catch {
      return { success: false, error: 'Unable to reach the server. Check your connection.' };
    }
  };

  const signOut = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
