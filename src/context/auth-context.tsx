'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import type { User } from '@/types/user'; // Ensure User type is defined

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  verifyAndChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname

  const fetchUser = useCallback(async (isInitialLoad = false) => {
    // Only set loading true on initial load or explicit refresh actions
    if (isInitialLoad) setIsLoading(true);
    console.log("[AuthContext] Fetching user...");
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json(); // Always parse JSON

      if (res.ok && data.user) {
        setUser(data.user);
        console.log("[AuthContext] User fetched successfully:", data.user.login);
      } else {
        setUser(null);
        console.log("[AuthContext] No active session found or error fetching user:", res.status, data.error);
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user:', error);
      setUser(null); 
    } finally {
      if (isInitialLoad) setIsLoading(false);
      console.log("[AuthContext] Finished fetching user. Loading:", isLoading); 
    }
  }, [router, pathname, isLoading]); 

  useEffect(() => {
    fetchUser(true); 
    // eslint-disable-next-line react-hooks-exhaustive-deps
  }, []); 

  const login = useCallback(async (loginInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true); 
    console.log(`[AuthContext] Attempting login for: ${loginInput}`);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password: passwordInput }),
      });

      const data = await res.json(); 

      if (res.ok && data.user) {
        setUser(data.user);
        console.log("[AuthContext] Login successful:", data.user.login);
        return true;
      } else {
        console.log("[AuthContext] Login failed:", res.status, data.error || 'No error message from API');
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Login API error:', error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false); 
      console.log("[AuthContext] Login attempt finished.");
    }
  }, []); 

  const logout = useCallback(async () => {
    setIsLoading(true); 
    console.log("[AuthContext] Initiating logout...");
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      console.log("[AuthContext] Logout API call successful.");
    } catch (error) {
      console.error('[AuthContext] Logout API error:', error);
    } finally {
      setUser(null); 
      console.log("[AuthContext] Client-side user state cleared.");
      router.push('/login'); // Redirect to login page after logout
      router.refresh(); // Force refresh
      setIsLoading(false); 
      console.log("[AuthContext] Logout process complete.");
    }
  }, [router]); 

 const updateUser = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
        console.warn("[AuthContext] Attempted to update user while not logged in.");
        return false;
    }
    setIsLoading(true);
    console.log(`[AuthContext] Attempting to update user: ${user.login}`);
    try {
        const res = await fetch('/api/auth/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const data = await res.json(); 

        if (res.ok && data.user) {
            setUser(data.user); // Update local user state
            console.log("[AuthContext] User update successful:", data.user.login);
            return true;
        } else {
            console.error("[AuthContext] User update failed:", res.status, data.error || 'No error message from API');
            return false;
        }
    } catch (error) {
        console.error('[AuthContext] Update user API error:', error);
        return false;
    } finally {
        setIsLoading(false);
        console.log("[AuthContext] User update attempt finished.");
    }
 }, [user]);

  const verifyAndChangePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) {
      console.warn("[AuthContext] Attempted to change password while not logged in.");
      return false;
    }
    setIsLoading(true);
    console.log(`[AuthContext] Attempting to change password for user: ${user.login}`);
    try {
      const res = await fetch('/api/auth/change-password', { // New API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        console.log("[AuthContext] Password change successful for:", user.login);
        // Optionally re-fetch user if password change affects other user data or session
        // await fetchUser(); 
        return true;
      } else {
        console.error("[AuthContext] Password change failed:", res.status, data.error || 'No error message from API');
        throw new Error(data.error || 'Не удалось изменить пароль.'); // Throw error to be caught by ProfileModal
      }
    } catch (error: any) {
      console.error('[AuthContext] Change password API error:', error);
      throw error; // Re-throw to be caught by ProfileModal
    } finally {
      setIsLoading(false);
      console.log("[AuthContext] Password change attempt finished.");
    }
  }, [user]);


  useEffect(() => {
    console.log("[AuthContext] User state changed:", user?.login ?? 'null');
  }, [user]);

  useEffect(() => {
    console.log("[AuthContext] Loading state changed:", isLoading);
  }, [isLoading]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, verifyAndChangePassword }}>
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
