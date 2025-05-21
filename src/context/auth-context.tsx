/**
 * @file Контекст аутентификации пользователя.
 * Предоставляет информацию о текущем пользователе, состоянии загрузки,
 * а также функции для входа, выхода, обновления данных пользователя и смены пароля.
 */
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

/**
 * Интерфейс для контекста аутентификации.
 */
interface AuthContextType {
  /** Текущий аутентифицированный пользователь или null. */
  user: User | null;
  /** Флаг, указывающий, идет ли процесс загрузки данных пользователя. */
  isLoading: boolean;
  /** Флаг, указывающий, нужно ли показывать предупреждение о смене пароля. */
  showPasswordChangeWarning: boolean;
  /**
   * Функция для входа пользователя.
   * @param login - Логин пользователя.
   * @param password - Пароль пользователя.
   * @returns Promise, который разрешается в true при успешном входе, иначе false.
   */
  login: (login: string, password: string) => Promise<boolean>;
  /**
   * Функция для выхода пользователя.
   * @returns Promise, который разрешается после завершения процесса выхода.
   */
  logout: () => Promise<void>;
  /**
   * Функция для обновления данных пользователя.
   * @param updates - Частичный объект User с обновляемыми полями.
   * @returns Promise, который разрешается в true при успешном обновлении, иначе false.
   */
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  /**
   * Функция для проверки текущего пароля и его смены.
   * @param currentPassword - Текущий пароль.
   * @param newPassword - Новый пароль.
   * @returns Promise, который разрешается в true при успешной смене пароля, иначе false.
   */
  verifyAndChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  /** Функция для скрытия предупреждения о смене пароля. */
  clearPasswordChangeWarning: () => void;
}

// Создание контекста аутентификации
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Провайдер контекста аутентификации.
 * Оборачивает дочерние компоненты, предоставляя им доступ к данным и функциям аутентификации.
 * @param children - Дочерние React-элементы.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordChangeWarning, setShowPasswordChangeWarning] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); // Хук для отображения уведомлений

  /**
   * Асинхронная функция для получения данных текущего пользователя с сервера.
   * @param isInitialLoad - Флаг, указывающий, является ли это начальной загрузкой.
   */
  const fetchUser = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad && !isLoading) setIsLoading(true);
    console.log("[AuthContext] Получение данных пользователя...");
    try {
      const res = await fetch('/api/auth/user');
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        if (typeof data.showPasswordChangeWarning === 'boolean') {
            setShowPasswordChangeWarning(data.showPasswordChangeWarning);
        }
        console.log("[AuthContext] Пользователь успешно получен:", data.user.login);
      } else {
        setUser(null);
        setShowPasswordChangeWarning(false);
        console.log("[AuthContext] Активная сессия не найдена или ошибка при получении пользователя:", res.status, data.error);
      }
    } catch (error) {
      console.error('[AuthContext] Ошибка при получении пользователя:', error);
      setUser(null);
      setShowPasswordChangeWarning(false);
    } finally {
      if (isInitialLoad || isLoading) setIsLoading(false);
      console.log("[AuthContext] Завершено получение пользователя. Состояние загрузки:", isLoading); // Было isLoading, но это покажет предыдущее состояние
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // isLoading убран из зависимостей для предотвращения лишних вызовов

  // Получение данных пользователя при монтировании компонента
  useEffect(() => {
    fetchUser(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Асинхронная функция для входа пользователя.
   */
  const login = useCallback(async (loginInput: string, passwordInput: string): Promise<boolean> => {
    setIsLoading(true);
    setShowPasswordChangeWarning(false);
    let operationSuccessful = false;

    console.log(`[AuthContext] Попытка входа для: ${loginInput}`);
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
        operationSuccessful = true;
        console.log("[AuthContext] Вход успешен (перед setIsLoading(false)):", data.user.login);
      } else {
        setUser(null);
        console.log("[AuthContext] Вход не удался (перед setIsLoading(false)):", res.status, data.error || 'Нет сообщения об ошибке от API');
      }
    } catch (error) {
      console.error('[AuthContext] Ошибка API входа (перед setIsLoading(false)):', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log("[AuthContext] Попытка входа завершена, isLoading установлен в false.");
    }
    return operationSuccessful;
  }, [toast]); // Удалена зависимость router, так как он не используется для навигации здесь

  /**
   * Асинхронная функция для выхода пользователя.
   */
  const logout = useCallback(async () => {
    console.log("[AuthContext] Инициализация выхода...");
    setIsLoading(true);

    setUser(null);
    setShowPasswordChangeWarning(false);
    console.log("[AuthContext] Клиентское состояние пользователя немедленно очищено.");

    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        console.log("[AuthContext] Вызов API выхода успешен. Сессия на сервере уничтожена.");
      } else {
        const errorText = await res.text();
        console.error("[AuthContext] Вызов API выхода не удался:", res.status, errorText);
        toast({
          title: "Ошибка выхода на сервере",
          description: errorText || `Статус: ${res.status}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[AuthContext] Сетевая ошибка API выхода:', error);
      toast({
        title: "Ошибка сети при выходе",
        description: error.message || "Не удалось связаться с сервером.",
        variant: "destructive",
      });
    } finally {
      console.log("[AuthContext] Перенаправление на /login.");
      router.push('/login');
      setTimeout(() => {
        console.log("[AuthContext] Выполнение router.refresh().");
        router.refresh();
        setIsLoading(false);
        console.log("[AuthContext] Процесс выхода полностью завершен.");
      }, 50);
    }
  }, [router, toast]);

 /**
   * Асинхронная функция для обновления данных пользователя.
   */
 const updateUser = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!user) {
        console.warn("[AuthContext] Попытка обновить пользователя без входа в систему.");
        throw new Error("Пользователь не авторизован.");
    }
    setIsLoading(true);
    let updateSuccess = false;
    console.log(`[AuthContext] Попытка обновить пользователя: ${user.login}`);
    try {
        const res = await fetch('/api/auth/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const data = await res.json();

        if (res.ok && data.user) {
            setUser(data.user);
            console.log("[AuthContext] Обновление пользователя успешно:", data.user.login);
            updateSuccess = true;
        } else {
            console.error("[AuthContext] Обновление пользователя не удалось:", res.status, data.error || 'Нет сообщения об ошибке от API');
            throw new Error(data.error || 'Не удалось обновить данные пользователя.');
        }
    } catch (error: any) {
        console.error('[AuthContext] Ошибка API обновления пользователя:', error);
        throw error;
    } finally {
        setIsLoading(false);
        console.log("[AuthContext] Попытка обновления пользователя завершена.");
    }
    return updateSuccess;
 }, [user, toast]); // Добавлен toast в зависимости, если он используется для уведомлений об ошибках (здесь не используется, но для консистентности)

  /**
   * Асинхронная функция для проверки текущего пароля и его смены.
   */
  const verifyAndChangePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) {
      console.warn("[AuthContext] Попытка сменить пароль без входа в систему.");
      throw new Error("Пользователь не авторизован.");
    }
    setIsLoading(true);
    let changeSuccess = false;
    console.log(`[AuthContext] Попытка сменить пароль для пользователя: ${user.login}`);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        console.log("[AuthContext] Смена пароля успешна для:", user.login);
        setShowPasswordChangeWarning(false);
        changeSuccess = true;
      } else {
        console.error("[AuthContext] Смена пароля не удалась:", res.status, data.error || 'Нет сообщения об ошибке от API');
        throw new Error(data.error || 'Не удалось изменить пароль.');
      }
    } catch (error: any) {
      console.error('[AuthContext] Ошибка API смены пароля:', error);
      throw error;
    } finally {
      setIsLoading(false);
      console.log("[AuthContext] Попытка смены пароля завершена.");
    }
    return changeSuccess;
  }, [user, toast]); // Добавлен toast в зависимости

  /**
   * Функция для скрытия предупреждения о смене пароля.
   */
  const clearPasswordChangeWarning = useCallback(() => {
    setShowPasswordChangeWarning(false);
  }, []);

  // Логирование изменений состояния пользователя, загрузки и предупреждения
  useEffect(() => {
    // console.log("[AuthContext] Состояние изменено:", user?.login ?? 'null', "isLoading:", isLoading, "showWarning:", showPasswordChangeWarning);
  }, [user, isLoading, showPasswordChangeWarning]);

  // Предоставление значений контекста дочерним компонентам
  return (
    <AuthContext.Provider value={{ user, isLoading, showPasswordChangeWarning, login, logout, updateUser, verifyAndChangePassword, clearPasswordChangeWarning }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Хук для использования контекста аутентификации.
 * @returns Объект контекста аутентификации.
 * @throws Ошибка, если хук используется вне AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};
