import { NextResponse } from 'next/server';
import { getUserDataFromSheet, verifyPassword } from '@/services/google-sheets-service';
import { session } from '@/lib/session';
import type { User } from '@/types/user'; // Ensure User type is defined

export async function POST(request: Request) {
  try {
    const { login, password } = await request.json();

    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const userData = await getUserDataFromSheet(login);

    if (!userData || !userData.passwordHash) {
      console.log(`[API Login] User not found or missing password hash for login: ${login}`);
      return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 });
    }

    // Verify password (assuming plain text comparison for now, replace with hashing later)
    // const passwordMatches = await verifyPassword(password, userData.passwordHash); // Use verifyPassword for hashed passwords
    const passwordMatches = password === userData.passwordHash; // Simple comparison for now

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

    await session().set('user', userSessionData);
    await session().save();

    console.log(`[API Login] Successful login for user: ${login}`);
    return NextResponse.json({ user: userSessionData });

  } catch (error: any) {
    console.error('[API Login] Error during login:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
