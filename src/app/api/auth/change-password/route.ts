
import { NextResponse } from 'next/server';
import { session } from '@/lib/session';
import {
  getUserDataFromSheet,
  verifyPassword as verifySheetPassword, // This will use the universal verifyPassword
  updateUserInSheet,
  hashPassword, // This will use bcrypt
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
    
    // Note: We will check if newPassword === currentPassword AFTER verifying currentPassword,
    // because currentPassword might be plain text and newPassword would be compared to its hash.
    // The verifySheetPassword will handle the actual comparison.

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
    
    // Now that current password is verified, check if new password is same as current
    // This comparison might not be perfect if current password was plain text and new is being hashed,
    // but it's a basic check. A more robust check would be to hash newPassword and compare with stored.
    // However, an even better check would be if verifyPassword could tell us if the match was against plain text.
    // For now, let's allow changing to the same password if the user really wants to (and it gets re-hashed).
    // OR, we can prevent it if the newPassword (plain) matches the currentPassword (plain) - only if current is not hashed.
    if (userDataFromSheet.passwordHash && !(userDataFromSheet.passwordHash.startsWith('$2a$') || userDataFromSheet.passwordHash.startsWith('$2b$')) && !userDataFromSheet.passwordHash.startsWith('ENC_XOR')) {
      if (newPassword === currentPassword) {
         return NextResponse.json({ error: 'Новый пароль не должен совпадать с текущим (если текущий не был зашифрован)' }, { status: 400 });
      }
    }


    const newPasswordHash = await hashPassword(newPassword); // Use bcrypt hashPassword
    console.log(`[API ChangePassword] New password hashed with bcrypt for user: ${currentUser.login}: ${newPasswordHash.substring(0,10)}...`);


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
