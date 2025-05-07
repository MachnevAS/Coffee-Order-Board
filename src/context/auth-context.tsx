
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
  const { toast } = useToast();

  const fetchUser = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad && !isLoading) setIsLoading(true);
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
      if (isInitialLoad || isLoading) setIsLoading(false);
      console.log("[AuthContext] Finished fetching user. Loading state:", isLoading);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchUser(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        router.push('/'); // Redirect to home page after successful login
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
  }, [router, toast]);

  const logout = useCallback(async () => {
    console.log("[AuthContext] Initiating logout...");
    setIsLoading(true);

    // Clear client-side user state first
    setUser(null);
    setShowPasswordChangeWarning(false);
    console.log("[AuthContext] Client-side user state immediately cleared.");

    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        console.log("[AuthContext] Logout API call successful. Server session destroyed.");
      } else {
        const errorText = await res.text();
        console.error("[AuthContext] Logout API call failed:", res.status, errorText);
        toast({
          title: "Ошибка выхода на сервере",
          description: errorText || `Статус: ${res.status}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[AuthContext] Logout API network error:', error);
      toast({
        title: "Ошибка сети при выходе",
        description: error.message || "Не удалось связаться с сервером.",
        variant: "destructive",
      });
    } finally {
      // Navigate to login page
      console.log("[AuthContext] Navigating to /login.");
      router.push('/login');
      
      // Force a refresh to ensure middleware and server state are re-evaluated
      // A small delay can help ensure cookie changes from API response are processed
      setTimeout(() => {
        console.log("[AuthContext] Executing router.refresh().");
        router.refresh();
        setIsLoading(false); // Set loading to false after all operations
        console.log("[AuthContext] Logout process fully complete.");
      }, 50); // Delay of 50ms
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
        setShowPasswordChangeWarning(false); // Clear warning if password is changed
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
    console.log("[AuthContext] User state changed:", user?.login ?? 'null', "isLoading:", isLoading, "showWarning:", showPasswordChangeWarning);
  }, [user, isLoading, showPasswordChangeWarning]);


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
