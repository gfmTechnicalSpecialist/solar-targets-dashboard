import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  signIn: async () => false,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Demo credentials for the executive dashboard
const DEMO_USERS: Record<string, { password: string; name: string }> = {
  'admin@solarpv.com': { password: 'admin123', name: 'Admin User' },
  'exec@solarpv.com': { password: 'exec123', name: 'Executive User' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('solar-dashboard-user');
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('solar-dashboard-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('solar-dashboard-user');
    }
  }, [user]);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    const entry = DEMO_USERS[email.toLowerCase()];
    if (entry && entry.password === password) {
      setUser({ email: email.toLowerCase(), name: entry.name });
      return true;
    }
    return false;
  };

  const signOut = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
