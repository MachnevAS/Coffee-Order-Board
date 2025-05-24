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

const MIN_SESSION_PASSWORD_LENGTH = 32; // Минимальная длина пароля сессии, как указано в README

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
        // Установлено в false для разрешения HTTP при локальном тестировании производственной сборки.
        // ВНИМАНИЕ: Для реального продакшена на HTTPS ОБЯЗАТЕЛЬНО верните secure: true!
        secure: false, // process.env.NODE_ENV === 'production', 
        maxAge: 60 * 60 * 24 * 7, // 1 неделя
        path: '/', // Убедимся, что cookie доступен для всех путей
    },
};

/**
 * Асинхронная функция для получения объекта сессии.
 * Использует `cookies()` из `next/headers` для доступа к cookie.
 * @returns {Promise<IronSession<IronSessionData>>} Promise, который разрешается объектом сессии.
 * @throws {Error} Если переменная окружения IRON_SESSION_PASSWORD не установлена или слишком короткая.
 */
export async function session(): Promise<IronSession<IronSessionData>> {
    const sessionPassword = process.env.IRON_SESSION_PASSWORD;

    if (!sessionPassword) {
        const errorMessage = "КРИТИЧЕСКАЯ ОШИБКА: Переменная окружения IRON_SESSION_PASSWORD не установлена. Сессии не будут работать. Пожалуйста, проверьте ваш файл .env или конфигурацию сервера.";
        console.error(`[SessionSetupError] ${errorMessage}`);
        // Эта ошибка будет видна на сервере и может предотвратить запуск, если сессия критична
        throw new Error(errorMessage);
    }

    if (sessionPassword.length < MIN_SESSION_PASSWORD_LENGTH) {
        const errorMessage = `КРИТИЧЕСКАЯ ОШИБКА: IRON_SESSION_PASSWORD слишком короткий. Он должен быть не менее ${MIN_SESSION_PASSWORD_LENGTH} символов. Текущая длина: ${sessionPassword.length}. Сессии могут работать некорректно или быть небезопасными. Обновите его в вашем .env файле или конфигурации сервера.`;
        console.error(`[SessionSetupError] ${errorMessage}`);
        // Можно также бросить ошибку здесь, если это критично для безопасности/работы
        // throw new Error("Пароль сессии IRON_SESSION_PASSWORD слишком короткий.");
    }

    // getIronSession возвращает Promise, поэтому используем await
    return getIronSession<IronSessionData>(cookies(), sessionOptions);
}
