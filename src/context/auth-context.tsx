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
        // Redirect if on a protected page and no user is found (except during initial load check)
        // Middleware should primarily handle this, but added as a safety net
        // if (!isInitialLoad && pathname !== '/login') { // Check if not already on login
        //   console.log("[AuthContext] Redirecting to /login due to missing user session.");
        //   router.push('/login');
        // }
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user:', error);
      setUser(null); // Ensure user is null on error
      // Redirect on fetch error if on a protected page
      // if (!isInitialLoad && pathname !== '/login') {
      //    console.log("[AuthContext] Redirecting to /login due to fetch error.");
      //    router.push('/login');
      // }
    } finally {
      // Only set loading false after the initial check completes
      if (isInitialLoad) setIsLoading(false);
      console.log("[AuthContext] Finished fetching user. Loading:", isLoading); // Log final loading state
    }
  }, [router, pathname, isLoading]); // Include isLoading in dependency array for logging

  // Fetch user on initial load only
  useEffect(() => {
    fetchUser(true); // Pass true for initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  const login = useCallback(async (loginInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true); // Set loading during login attempt
    console.log(`[AuthContext] Attempting login for: ${loginInput}`);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password: passwordInput }),
      });

      const data = await res.json(); // Parse JSON regardless of status

      if (res.ok && data.user) {
        setUser(data.user);
        console.log("[AuthContext] Login successful:", data.user.login);
        // No router.push here, let the LoginPage handle redirection after successful login state update
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
      setIsLoading(false); // Stop loading after login attempt completes
      console.log("[AuthContext] Login attempt finished.");
    }
  }, []); // No router dependency needed here

  const logout = useCallback(async () => {
    setIsLoading(true); // Indicate loading during logout
    console.log("[AuthContext] Initiating logout...");
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      console.log("[AuthContext] Logout API call successful.");
    } catch (error) {
      console.error('[AuthContext] Logout API error:', error);
    } finally {
      setUser(null); // Clear user state immediately
      console.log("[AuthContext] Client-side user state cleared.");
      // Redirect is handled by middleware now, no need to push here
      // router.push('/login');
      setIsLoading(false); // Stop loading
      console.log("[AuthContext] Logout process complete.");
    }
  }, []); // Removed router dependency

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
        const data = await res.json(); // Always parse JSON

        if (res.ok && data.user) {
            setUser(data.user);
            console.log("[AuthContext] User update successful:", data.user.login);
            return true;
        } else {
            console.error("[AuthContext] User update failed:", res.status, data.error || 'No error message from API');
            // Optionally fetch user again to ensure sync if update fails - might cause loop if fetch also fails
            // await fetchUser();
            return false;
        }
    } catch (error) {
        console.error('[AuthContext] Update user API error:', error);
        // await fetchUser(); // Re-sync on error
        return false;
    } finally {
        setIsLoading(false);
        console.log("[AuthContext] User update attempt finished.");
    }
 }, [user]); // fetchUser removed to prevent potential loops


  // Log user state changes for debugging
  useEffect(() => {
    console.log("[AuthContext] User state changed:", user?.login ?? 'null');
  }, [user]);

  // Log loading state changes for debugging
  useEffect(() => {
    console.log("[AuthContext] Loading state changed:", isLoading);
  }, [isLoading]);

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
