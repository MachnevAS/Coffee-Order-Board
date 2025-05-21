/**
 * @file API маршрут для смены пароля аутентифицированного пользователя.
 */
import { NextResponse } from 'next/server';
import { session } from '@/lib/session'; // Утилита для работы с сессиями
import {
  getUserDataFromSheet,
  verifyPassword as verifySheetPassword, // Используем универсальную функцию verifyPassword из google-sheets-service
  updateUserInSheet,
  hashPassword, // Используем bcrypt для хеширования нового пароля
} from '@/services/google-sheets-service'; // Сервисы для работы с Google Sheets
// import type { User } from '@/types/user'; // Тип User не используется напрямую в этом файле, но может быть полезен для контекста

/**
 * Обработчик POST-запроса для смены пароля.
 * @param {Request} request - Объект входящего запроса с текущим и новым паролями.
 * @returns {Promise<NextResponse>} Ответ сервера с сообщением об успехе или ошибке.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const currentSession = await session(); // Получаем текущую сессию
    const currentUser = currentSession.user; // Извлекаем данные текущего пользователя

    // Проверка аутентификации пользователя
    if (!currentUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json(); // Получаем текущий и новый пароли из тела запроса

    // Валидация входных данных
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Текущий и новый пароли обязательны' }, { status: 400 });
    }
    if (newPassword.length < 6) { // Минимальная длина нового пароля
      return NextResponse.json({ error: 'Новый пароль должен быть не менее 6 символов' }, { status: 400 });
    }

    // Замечание: Проверка newPassword === currentPassword будет выполнена после проверки currentPassword,
    // так как currentPassword может быть в открытом тексте, а newPassword будет сравниваться с его хешем.
    // verifySheetPassword обработает фактическое сравнение.

    console.log(`[API ChangePassword] Попытка смены пароля для пользователя: ${currentUser.login}`);
    const userDataFromSheet = await getUserDataFromSheet(currentUser.login); // Получаем данные пользователя из Google Sheets

    // Проверка, найдены ли данные пользователя и есть ли у него хеш пароля
    if (!userDataFromSheet || !userDataFromSheet.passwordHash) {
      console.error(`[API ChangePassword] Данные пользователя не найдены или отсутствует хеш пароля для ${currentUser.login}`);
      return NextResponse.json({ error: 'Не удалось проверить пользователя' }, { status: 500 });
    }

    // Проверка текущего пароля
    const isCurrentPasswordValid = await verifySheetPassword(currentPassword, userDataFromSheet.passwordHash);

    if (!isCurrentPasswordValid) {
      console.log(`[API ChangePassword] Неверный текущий пароль для пользователя: ${currentUser.login}`);
      return NextResponse.json({ error: 'Текущий пароль неверен' }, { status: 400 });
    }

    // Теперь, когда текущий пароль проверен, проверяем, не совпадает ли новый пароль с текущим.
    // Это сравнение может быть не идеальным, если текущий пароль был в открытом тексте, а новый хешируется.
    // Более надежная проверка — хешировать newPassword и сравнивать с сохраненным.
    // Однако, еще лучшая проверка была бы, если бы verifyPassword мог сообщить, было ли совпадение с открытым текстом.
    // На данный момент, разрешаем смену на тот же пароль, если пользователь действительно этого хочет (и он будет перехеширован).
    // ИЛИ, мы можем предотвратить это, если newPassword (открытый) совпадает с currentPassword (открытый) - только если текущий не хеширован.
    // Это условие проверяет, если текущий пароль НЕ является bcrypt или XOR хешем (т.е., он в открытом тексте)
    if (userDataFromSheet.passwordHash && !(userDataFromSheet.passwordHash.startsWith('$2a$') || userDataFromSheet.passwordHash.startsWith('$2b$')) && !userDataFromSheet.passwordHash.startsWith('ENC_XOR')) {
      if (newPassword === currentPassword) {
         // Запрещаем смену на тот же пароль, если текущий пароль был в открытом тексте
         return NextResponse.json({ error: 'Новый пароль не должен совпадать с текущим (если текущий не был зашифрован)' }, { status: 400 });
      }
    }


    const newPasswordHash = await hashPassword(newPassword); // Хешируем новый пароль с использованием bcrypt
    console.log(`[API ChangePassword] Новый пароль захеширован bcrypt для пользователя: ${currentUser.login}: ${newPasswordHash.substring(0,10)}...`);

    // Обновляем хеш пароля пользователя в Google Sheet
    const updateSuccess = await updateUserInSheet(currentUser.login, { passwordHash: newPasswordHash });

    if (!updateSuccess) {
      console.error(`[API ChangePassword] Не удалось обновить пароль в Google Sheet для пользователя: ${currentUser.login}`);
      return NextResponse.json({ error: 'Не удалось обновить пароль в таблице' }, { status: 500 });
    }

    console.log(`[API ChangePassword] Пароль успешно изменен для пользователя: ${currentUser.login}`);
    return NextResponse.json({ message: 'Пароль успешно изменен' });

  } catch (error: any) {
    console.error('[API ChangePassword] Ошибка во время смены пароля:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера при смене пароля' }, { status: 500 });
  }
}
