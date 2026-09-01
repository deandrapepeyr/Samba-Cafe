'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type Role = 'manager' | 'cashier' | null;

interface AuthContextType {
  role: Role;
  userName: string | null;
  login: (role: Role, name: string) => void;
  logout: () => void;
  updateUserName: (name: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedRole = localStorage.getItem('samba_role') as Role;
    const savedName = localStorage.getItem('samba_name');
    if (savedRole && savedName) {
      setRole(savedRole);
      setUserName(savedName);

      // Auto-sync user name with database
      if (savedRole === 'manager') {
        supabase
          .from('users')
          .select('name')
          .eq('role', 'manager')
          .maybeSingle()
          .then(({ data }) => {
            if (data && data.name) {
              setUserName(data.name);
              localStorage.setItem('samba_name', data.name);
            }
          });
      } else {
        supabase
          .from('users')
          .select('name')
          .eq('name', savedName)
          .maybeSingle()
          .then(({ data }) => {
            if (data && data.name) {
              setUserName(data.name);
              localStorage.setItem('samba_name', data.name);
            }
          });
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newRole: Role, newName: string) => {
    setRole(newRole);
    setUserName(newName);
    if (newRole) {
      localStorage.setItem('samba_role', newRole);
      localStorage.setItem('samba_name', newName);
    }
    if (newRole === 'manager') {
      router.push('/dashboard');
    } else {
      router.push('/pos');
    }
  };

  const updateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('samba_name', newName);
  };

  const logout = () => {
    setRole(null);
    setUserName(null);
    localStorage.removeItem('samba_role');
    localStorage.removeItem('samba_name');
    router.push('/pos');
  };

  return (
    <AuthContext.Provider value={{ role, userName, login, logout, updateUserName, isLoading }}>
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
