/**
 * @file API маршрут для выхода пользователя из системы.
 * Уничтожает текущую сессию пользователя.
 */
import { NextResponse } from 'next/server';
import { session } from '@/lib/session'; // Импорт функции для работы с сессией

/**
 * Обработчик POST-запроса для выхода пользователя.
 * @returns {Promise<NextResponse>} Ответ сервера.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const currentSession = await session(); // Получаем текущую сессию
    const user = currentSession.user; // Проверяем, есть ли пользователь в сессии

    if (user) {
      console.log(`[API Logout] Пользователь найден в сессии: ${user.login}. Попытка уничтожения сессии.`);
    } else {
      console.log("[API Logout] Активная сессия для уничтожения не найдена. Это ожидаемо, если пользователь уже вышел или cookie был удален вручную.");
    }

    console.log("[API Logout] Вызов currentSession.destroy().");
    await currentSession.destroy(); // Уничтожаем сессию (iron-session должен установить cookie на истечение)
    console.log("[API Logout] currentSession.destroy() успешно вызван. Cookie должен быть очищен iron-session.");

    const response = NextResponse.json({ message: 'Выход выполнен успешно' });

    // Обычно iron-session.destroy() сам заботится об истечении cookie.
    // Явное указание maxAge: -1 является защитной мерой, но чаще всего избыточно.
    // response.cookies.set(sessionOptions.cookieName, '', { maxAge: -1, path: '/' });
    // console.log(`[API Logout] Принудительно установлен cookie ${sessionOptions.cookieName} на истечение (должно быть избыточно).`);

    return response;
  } catch (error) {
    console.error('[API Logout] Ошибка во время выхода:', error);
    return NextResponse.json({ error: 'Не удалось выполнить выход' }, { status: 500 });
  }
}
