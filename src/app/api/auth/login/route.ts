
import { NextResponse } from 'next/server';
import { getUserDataFromSheet, verifyPassword } from '@/services/google-sheets-service';
import { session } from '@/lib/session';
import type { User } from '@/types/user'; // Ensure User type is defined

const ENCRYPTION_TAG = "encryption";

export async function POST(request: Request) {
  try {
    const { login, password } = await request.json();

    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    console.log(`[API Login] Attempting login for user: ${login}`);
    const userData = await getUserDataFromSheet(login);

    if (!userData || !userData.passwordHash) {
      console.log(`[API Login] User not found or missing password hash for login: ${login}. UserData: ${JSON.stringify(userData)}`);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }
    console.log(`[API Login] Found user data for login: ${login}. Stored passwordHash: "${userData.passwordHash}"`);


    // Verify password using the function (even if it's plain text for now)
    const passwordMatches = await verifyPassword(password, userData.passwordHash);
    
    if (!passwordMatches) {
      console.log(`[API Login] Invalid password for login: ${login}`);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    // Password matches, create session
    const userSessionData: User = {
      id: userData.id,
      login: userData.login,
      firstName: userData.firstName,
      middleName: userData.middleName,
      lastName: userData.lastName,
      position: userData.position,
      iconColor: userData.iconColor,
      // Exclude passwordHash from session
    };

    const currentSession = await session(); // Await the session
    currentSession.user = userSessionData; // Set the user data
    await currentSession.save(); // Save the session

    const showPasswordChangeWarning = typeof userData.passwordHash === 'string' && !userData.passwordHash.startsWith(ENCRYPTION_TAG);

    console.log(`[API Login] Successful login for user: ${login}, session saved. Password warning: ${showPasswordChangeWarning}`);
    return NextResponse.json({ user: userSessionData, showPasswordChangeWarning });

  } catch (error: any) {
    console.error('[API Login] Error during login:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
