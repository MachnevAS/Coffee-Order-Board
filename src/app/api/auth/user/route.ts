/**
 * @file API маршрут для получения и обновления данных пользователя.
 * GET: Возвращает данные текущего аутентифицированного пользователя из сессии.
 * PUT: Обновляет данные текущего аутентифицированного пользователя в сессии и Google Sheets.
 */
import { NextResponse } from 'next/server';
import { session } from '@/lib/session'; // Утилита для работы с сессиями
import type { User } from '@/types/user'; // Тип данных пользователя
import { updateUserInSheet } from '@/services/google-sheets-service'; // Сервис для работы с Google Sheets

/**
 * Обработчик GET-запроса.
 * Получает данные пользователя из текущей сессии.
 * @returns {Promise<NextResponse>} Ответ с данными пользователя или null, если пользователь не аутентифицирован.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const currentSession = await session(); // Получаем текущую сессию
    const user = currentSession.user; // Извлекаем данные пользователя

    if (user) {
      // Если пользователь найден в сессии, возвращаем его данные
      return NextResponse.json({ user });
    } else {
      // Если пользователь не найден, возвращаем null
      return NextResponse.json({ user: null });
    }
  } catch (error) {
    console.error('[API User GET] Ошибка при получении сессии пользователя:', error);
    return NextResponse.json({ error: 'Не удалось получить данные пользователя' }, { status: 500 });
  }
}

/**
 * Обработчик PUT-запроса.
 * Обновляет данные аутентифицированного пользователя.
 * @param {Request} request - Объект входящего запроса с данными для обновления.
 * @returns {Promise<NextResponse>} Ответ с обновленными данными пользователя или сообщением об ошибке.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const sessionData = await session(); // Получаем текущую сессию
    const currentUserSession = sessionData.user; // Извлекаем данные текущего пользователя из сессии

    // Проверка аутентификации пользователя
    if (!currentUserSession) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const updates: Partial<User> = await request.json(); // Получаем данные для обновления из тела запроса

    // Валидация обновлений: разрешаем обновление только определенных полей.
    // ID и критические поля не должны изменяться через этот эндпоинт.
    // Смена пароля обрабатывается отдельным эндпоинтом.
    const allowedUpdates: Partial<User> = {
        login: updates.login || undefined, // Логин может быть обновлен
        firstName: updates.firstName || undefined,
        middleName: updates.middleName || undefined,
        lastName: updates.lastName || undefined,
        position: updates.position || undefined,
        iconColor: updates.iconColor || undefined,
    };

    // Фильтруем undefined значения перед отправкой в сервис Google Sheets
    const validUpdates = Object.entries(allowedUpdates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key as keyof Partial<User>] = value;
        }
        return acc;
    }, {} as Partial<User>);

    // Обновление данных пользователя в Google Sheet, если есть что обновлять
    if (Object.keys(validUpdates).length > 0) {
        console.log(`[API User PUT] Обновление пользователя (исходный логин: ${currentUserSession.login}) в таблице данными:`, validUpdates);
        // Передаем оригинальный логин из сессии для идентификации пользователя в таблице,
        // так как сам логин может быть частью обновлений.
        const updateSuccess = await updateUserInSheet(currentUserSession.login, validUpdates);

        if (!updateSuccess) {
            console.error(`[API User PUT] Не удалось обновить пользователя ${currentUserSession.login} в Google Sheet.`);
            return NextResponse.json({ error: 'Не удалось обновить данные пользователя в таблице' }, { status: 500 });
        }
        console.log(`[API User PUT] Пользователь ${currentUserSession.login} успешно обновлен в Google Sheet.`);
    } else {
         console.log(`[API User PUT] Нет действительных обновлений для пользователя ${currentUserSession.login}. Пропуск обновления таблицы.`);
    }

    // Обновление данных пользователя в сессии
    // Важно: ID из оригинальной сессии пользователя должен быть сохранен, если он не является частью 'validUpdates'.
    const updatedUserInSession = { ...currentUserSession, ...validUpdates };
    sessionData.user = updatedUserInSession; // Обновляем данные пользователя в объекте сессии
    await sessionData.save(); // Сохраняем изменения в сессии
    console.log(`[API User PUT] Сессия обновлена для пользователя (новый логин, если изменен: ${updatedUserInSession.login}).`);

    return NextResponse.json({ user: updatedUserInSession }); // Возвращаем обновленные данные пользователя

  } catch (error) {
    console.error('[API User PUT] Ошибка при обновлении пользователя:', error);
    // Обработка ошибок, связанных с дублированием логина, если Google Sheets сервис их возвращает
    if (error instanceof Error && error.message.includes("уже существует")) {
        return NextResponse.json({ error: error.message }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ error: 'Не удалось обновить данные пользователя' }, { status: 500 });
  }
}
