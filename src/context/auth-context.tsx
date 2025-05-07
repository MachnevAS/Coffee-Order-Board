
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  showPasswordChangeWarning: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  verifyAndChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearPasswordChangeWarning: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordChangeWarning, setShowPasswordChangeWarning] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // Keep pathname for potential future use, though not directly in fetchUser deps
  const { toast } = useToast();

  const fetchUser = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad && !isLoading) setIsLoading(true); // Set loading true only if not already loading
    console.log("[AuthContext] Fetching user...");
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        if (typeof data.showPasswordChangeWarning === 'boolean') {
            setShowPasswordChangeWarning(data.showPasswordChangeWarning);
        }
        console.log("[AuthContext] User fetched successfully:", data.user.login);
      } else {
        setUser(null);
        setShowPasswordChangeWarning(false);
        console.log("[AuthContext] No active session found or error fetching user:", res.status, data.error);
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user:', error);
      setUser(null);
      setShowPasswordChangeWarning(false);
    } finally {
      // Only set isLoading to false if it was an initial load attempt or if it's currently true
      if (isInitialLoad || isLoading) setIsLoading(false);
      console.log("[AuthContext] Finished fetching user. Loading state:", isLoading);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // isLoading removed from deps to avoid re-triggering fetchUser on its own change

  useEffect(() => {
    fetchUser(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount

  const login = useCallback(async (loginInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true);
    setShowPasswordChangeWarning(false);
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
        if (data.showPasswordChangeWarning) {
          setShowPasswordChangeWarning(true);
        }
        console.log("[AuthContext] Login successful:", data.user.login);
        // router.push('/'); // LoginPage now handles this redirect
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
  }, [toast]); // Added toast to dependencies

  const logout = useCallback(async () => {
    console.log("[AuthContext] Initiating logout...");
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      console.log("[AuthContext] Logout API call successful. Session cookie should be cleared by server.");
    } catch (error) {
      console.error('[AuthContext] Logout API error:', error);
      toast({
        title: "Ошибка выхода",
        description: "Не удалось связаться с сервером для выхода. Попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setUser(null);
      setShowPasswordChangeWarning(false);
      setIsLoading(false); 
      console.log("[AuthContext] Client-side user state cleared. Navigating to /login.");
      router.push('/login');
      router.refresh(); // Force re-evaluation of server state and middleware
      console.log("[AuthContext] Logout process complete. Navigated to /login and refreshed.");
    }
  }, [router, toast]);

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
        setShowPasswordChangeWarning(false);
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

  const clearPasswordChangeWarning = useCallback(() => {
    setShowPasswordChangeWarning(false);
  }, []);


  useEffect(() => {
    console.log("[AuthContext] User state changed:", user?.login ?? 'null', "isLoading:", isLoading);
  }, [user, isLoading]);


  return (
    <AuthContext.Provider value={{ user, isLoading, showPasswordChangeWarning, login, logout, updateUser, verifyAndChangePassword, clearPasswordChangeWarning }}>
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

