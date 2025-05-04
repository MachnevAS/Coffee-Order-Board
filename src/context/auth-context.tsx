'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types/user'; // Ensure User type is defined

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/user');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        console.log("[AuthContext] User fetched:", data.user?.login);
      } else {
        setUser(null);
        console.log("[AuthContext] No active session found.");
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user:', error);
      setUser(null); // Ensure user is null on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch user on initial load
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (loginInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password: passwordInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        console.log("[AuthContext] Login successful:", data.user.login);
        return true;
      } else {
        console.log("[AuthContext] Login failed:", res.status);
        setUser(null); // Ensure user is null on failed login
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Login API error:', error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      console.log("[AuthContext] Logout API call successful.");
    } catch (error) {
      console.error('[AuthContext] Logout API error:', error);
      // Still proceed with client-side logout even if API fails
    } finally {
      setUser(null);
      setIsLoading(false);
      router.push('/login'); // Redirect to login after logout
      console.log("[AuthContext] Client-side logout complete, redirecting.");
    }
  }, [router]);

 const updateUser = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);
    try {
        const res = await fetch('/api/auth/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (res.ok) {
            const data = await res.json();
            setUser(data.user); // Update user state with the response from the API
            console.log("[AuthContext] User update successful:", data.user.login);
            return true;
        } else {
            console.error("[AuthContext] User update failed:", res.status);
            // Optionally fetch user again to ensure sync if update fails
            // await fetchUser();
            return false;
        }
    } catch (error) {
        console.error('[AuthContext] Update user API error:', error);
        // Optionally fetch user again to ensure sync on error
        // await fetchUser();
        return false;
    } finally {
        setIsLoading(false);
    }
 }, [user]); // Add fetchUser if you want to re-sync on error/failure


  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
