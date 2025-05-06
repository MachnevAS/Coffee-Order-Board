
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/types/user';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  showPasswordChangeWarning: boolean; // Added
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  verifyAndChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearPasswordChangeWarning: () => void; // Added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordChangeWarning, setShowPasswordChangeWarning] = useState(false); // Added state
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const fetchUser = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    console.log("[AuthContext] Fetching user...");
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        // Check for password warning status from user data if available,
        // or retain existing warning if not (e.g., if user object doesn't explicitly carry this state from backend)
        // This logic might need adjustment based on how backend sends warning status persistently
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
    setShowPasswordChangeWarning(false); // Reset warning on new login attempt
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
          setShowPasswordChangeWarning(true); // Set warning from API response
          // Toast is now shown on the page itself via an Alert component
        }
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
      setShowPasswordChangeWarning(false); // Clear warning on logout
      console.log("[AuthContext] Client-side user state cleared.");
      // router.push('/login'); // Middleware will handle redirect
      // router.refresh(); // Middleware will handle redirect
      setIsLoading(false);
      console.log("[AuthContext] Logout process complete. User should be redirected by middleware.");
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
        setShowPasswordChangeWarning(false); // Clear warning after successful password change
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
    console.log("[AuthContext] User state changed:", user?.login ?? 'null');
  }, [user]);

  useEffect(() => {
    console.log("[AuthContext] Loading state changed:", isLoading);
  }, [isLoading]);

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

