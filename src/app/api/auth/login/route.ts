/**
 * @file API маршрут для аутентификации пользователя.
 * Проверяет логин и пароль пользователя по данным из Google Sheets,
 * создает сессию при успешной аутентификации.
 */
import { NextResponse } from 'next/server';
import { getUserDataFromSheet, verifyPassword } from '@/services/google-sheets-service'; // Сервисы для работы с Google Sheets
import { session } from '@/lib/session'; // Утилита для работы с сессиями
import type { User } from '@/types/user'; // Тип данных пользователя

// Префиксы для распознавания различных форматов хешей паролей
const XOR_TAG = "ENC_XOR"; // Для старых XOR-зашифрованных паролей (если используется)
const BCRYPT_PREFIX_1 = "$2a$"; // Префикс bcrypt хеша
const BCRYPT_PREFIX_2 = "$2b$"; // Другой префикс bcrypt хеша

/**
 * Обработчик POST-запроса для входа пользователя.
 * @param {Request} request - Объект входящего запроса с логином и паролем.
 * @returns {Promise<NextResponse>} Ответ с данными пользователя и флагом предупреждения о смене пароля, или сообщение об ошибке.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { login, password } = await request.json(); // Получаем логин и пароль из тела запроса

    // Валидация входных данных
    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    console.log(`[API Login] Попытка входа для пользователя: ${login}`);
    const userData = await getUserDataFromSheet(login); // Получаем данные пользователя из Google Sheets

    // Проверка, найден ли пользователь и есть ли у него хеш пароля
    if (!userData || !userData.passwordHash) {
      console.log(`[API Login] Пользователь не найден или отсутствует хеш пароля для логина: ${login}. UserData: ${JSON.stringify(userData)}`);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }
    console.log(`[API Login] Найдены данные пользователя для логина: ${login}. Сохраненный passwordHash: "${userData.passwordHash.substring(0,10)}..."`);

    // Проверка пароля с использованием универсальной функции verifyPassword
    const passwordMatches = await verifyPassword(password, userData.passwordHash);

    if (!passwordMatches) {
      console.log(`[API Login] Неверный пароль для логина: ${login}`);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    // Пароль совпал, создаем сессию
    const userSessionData: User = { // Формируем данные пользователя для сессии
      id: userData.id,
      login: userData.login,
      firstName: userData.firstName,
      middleName: userData.middleName,
      lastName: userData.lastName,
      position: userData.position,
      iconColor: userData.iconColor,
      // Исключаем passwordHash из данных сессии для безопасности
    };

    const currentSession = await session(); // Получаем текущую сессию
    currentSession.user = userSessionData; // Сохраняем данные пользователя в сессии
    await currentSession.save(); // Сохраняем сессию

    // Определяем, нужно ли показывать предупреждение о смене пароля
    // Предупреждение показывается, если пароль хранится в открытом тексте (не bcrypt)
    // или если это старый XOR-зашифрованный пароль.
    const isBcryptHash = typeof userData.passwordHash === 'string' && (userData.passwordHash.startsWith(BCRYPT_PREFIX_1) || userData.passwordHash.startsWith(BCRYPT_PREFIX_2));
    const isOldXorHash = typeof userData.passwordHash === 'string' && userData.passwordHash.startsWith(XOR_TAG); // Если используется XOR
    const showPasswordChangeWarning = !isBcryptHash || isOldXorHash; // Показываем предупреждение, если не bcrypt ИЛИ если это старый XOR


    console.log(`[API Login] Успешный вход для пользователя: ${login}, сессия сохранена. Предупреждение о смене пароля: ${showPasswordChangeWarning}`);
    return NextResponse.json({ user: userSessionData, showPasswordChangeWarning }); // Возвращаем данные пользователя и флаг предупреждения

  } catch (error: any) {
    console.error('[API Login] Ошибка во время входа:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
