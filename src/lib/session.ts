/**
 * @file Управление сессиями с использованием iron-session.
 * Определяет опции сессии и предоставляет функцию для доступа к данным сессии.
 */
import { getIronSession, IronSession, IronSessionData } from 'iron-session';
import { cookies } from 'next/headers'; // Используется для доступа к cookie в серверных компонентах и API роутах
import type { User } from '@/types/user'; // Тип данных пользователя

// Расширение интерфейса IronSessionData для добавления поля user
declare module 'iron-session' {
  interface IronSessionData {
    user?: User; // Данные пользователя, хранящиеся в сессии
  }
}

/**
 * Опции для конфигурации iron-session.
 */
export const sessionOptions = {
  /** Пароль для шифрования cookie сессии. Должен быть не менее 32 символов. */
  password: process.env.IRON_SESSION_PASSWORD as string,
  /** Имя cookie, используемого для хранения сессии. */
  cookieName: 'coffee-app-session',
  /**
   * Опции для cookie.
   * secure: true - cookie будет отправляться только по HTTPS (рекомендуется для production).
   * maxAge: Время жизни cookie в секундах (здесь 1 неделя).
   */
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // Включаем secure cookies только в production
    maxAge: 60 * 60 * 24 * 7, // 1 неделя
  },
};

/**
 * Асинхронная функция для получения объекта сессии.
 * Использует `cookies()` из `next/headers` для доступа к cookie.
 * @returns {Promise<IronSession<IronSessionData>>} Promise, который разрешается объектом сессии.
 * @throws {Error} Если переменная окружения IRON_SESSION_PASSWORD не установлена.
 */
export async function session(): Promise<IronSession<IronSessionData>> {
    // Проверка наличия пароля сессии в переменных окружения
    if (!process.env.IRON_SESSION_PASSWORD) {
        throw new Error("Переменная окружения IRON_SESSION_PASSWORD не установлена.");
    }
    // getIronSession возвращает Promise, поэтому используем await
    return getIronSession<IronSessionData>(cookies(), sessionOptions);
}
