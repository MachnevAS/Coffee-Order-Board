
import { NextResponse } from 'next/server';
import { session } from '@/lib/session';
import {
  getUserDataFromSheet,
  verifyPassword as verifySheetPassword,
  updateUserInSheet,
  hashPassword, // Import hashPassword
} from '@/services/google-sheets-service';
import type { User } from '@/types/user';

export async function POST(request: Request) {
  try {
    const currentSession = await session();
    const currentUser = currentSession.user;

    if (!currentUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Текущий и новый пароли обязательны' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Новый пароль должен быть не менее 6 символов' }, { status: 400 });
    }
    if (newPassword === currentPassword) {
        return NextResponse.json({ error: 'Новый пароль не должен совпадать с текущим' }, { status: 400 });
    }


    console.log(`[API ChangePassword] Attempting password change for user: ${currentUser.login}`);
    const userDataFromSheet = await getUserDataFromSheet(currentUser.login);

    if (!userDataFromSheet || !userDataFromSheet.passwordHash) {
      console.error(`[API ChangePassword] User data not found or password hash missing for ${currentUser.login}`);
      return NextResponse.json({ error: 'Не удалось проверить пользователя' }, { status: 500 });
    }

    const isCurrentPasswordValid = await verifySheetPassword(currentPassword, userDataFromSheet.passwordHash);

    if (!isCurrentPasswordValid) {
      console.log(`[API ChangePassword] Invalid current password for user: ${currentUser.login}`);
      return NextResponse.json({ error: 'Текущий пароль неверен' }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(newPassword); // Use hashPassword
    console.log(`[API ChangePassword] New password hashed for user: ${currentUser.login}`);


    const updateSuccess = await updateUserInSheet(currentUser.login, { passwordHash: newPasswordHash });

    if (!updateSuccess) {
      console.error(`[API ChangePassword] Failed to update password in Google Sheet for user: ${currentUser.login}`);
      return NextResponse.json({ error: 'Не удалось обновить пароль в таблице' }, { status: 500 });
    }
    
    console.log(`[API ChangePassword] Password changed successfully for user: ${currentUser.login}`);
    return NextResponse.json({ message: 'Пароль успешно изменен' });

  } catch (error: any) {
    console.error('[API ChangePassword] Error during password change:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера при смене пароля' }, { status: 500 });
  }
}

