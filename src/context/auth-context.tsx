
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/types/user';
import { useToast } from '@/hooks/use-toast'; // Import useToast

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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast(); // Initialize toast

  const fetchUser = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    console.log("[AuthContext] Fetching user...");
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json();

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
  }, [isLoading]); // Removed router and pathname as they are not direct dependencies for fetchUser

  useEffect(() => {
    fetchUser(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (data.showPasswordChangeWarning) {
          toast({
            title: 'Рекомендация по безопасности',
            description: 'Ваш пароль хранится в небезопасном формате. Пожалуйста, смените его в настройках профиля.',
            variant: 'destructive', // Or a custom warning variant
            duration: 10000, // Show for longer
          });
        }
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
  }, [toast]); // Added toast as a dependency

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
      router.push('/login');
      router.refresh();
      setIsLoading(false);
      console.log("[AuthContext] Logout process complete.");
    }
  }, [router]);

 const updateUser = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
        console.warn("[AuthContext] Attempted to update user while not logged in.");
        throw new Error("Пользователь не авторизован.");
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
            setUser(data.user); 
            console.log("[AuthContext] User update successful:", data.user.login);
            return true;
        } else {
            console.error("[AuthContext] User update failed:", res.status, data.error || 'No error message from API');
            throw new Error(data.error || 'Не удалось обновить данные пользователя.');
        }
    } catch (error: any) {
        console.error('[AuthContext] Update user API error:', error);
        throw error; 
    } finally {
        setIsLoading(false);
        console.log("[AuthContext] User update attempt finished.");
    }
 }, [user]);

  const verifyAndChangePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) {
      console.warn("[AuthContext] Attempted to change password while not logged in.");
      throw new Error("Пользователь не авторизован.");
    }
    setIsLoading(true);
    console.log(`[AuthContext] Attempting to change password for user: ${user.login}`);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        console.log("[AuthContext] Password change successful for:", user.login);
        return true;
      } else {
        console.error("[AuthContext] Password change failed:", res.status, data.error || 'No error message from API');
        throw new Error(data.error || 'Не удалось изменить пароль.');
      }
    } catch (error: any) {
      console.error('[AuthContext] Change password API error:', error);
      throw error;
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
