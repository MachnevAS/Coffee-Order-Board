
import { NextResponse } from 'next/server';
import { getUserDataFromSheet, verifyPassword } from '@/services/google-sheets-service';
import { session } from '@/lib/session';
import type { User } from '@/types/user'; // Ensure User type is defined

const XOR_TAG = "ENC_XOR"; // For checking old XOR passwords
const BCRYPT_PREFIX_1 = "$2a$";
const BCRYPT_PREFIX_2 = "$2b$";


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
    console.log(`[API Login] Found user data for login: ${login}. Stored passwordHash: "${userData.passwordHash.substring(0,10)}..."`);


    // Verify password using the new universal verifyPassword function
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

    const currentSession = await session(); 
    currentSession.user = userSessionData; 
    await currentSession.save(); 

    // Determine if password change warning is needed
    // Warning if it's plain text (not starting with bcrypt prefixes) OR old XOR_TAG
    const isBcryptHash = typeof userData.passwordHash === 'string' && (userData.passwordHash.startsWith(BCRYPT_PREFIX_1) || userData.passwordHash.startsWith(BCRYPT_PREFIX_2));
    const isOldXorHash = typeof userData.passwordHash === 'string' && userData.passwordHash.startsWith(XOR_TAG);
    const showPasswordChangeWarning = !isBcryptHash || isOldXorHash;


    console.log(`[API Login] Successful login for user: ${login}, session saved. Password warning: ${showPasswordChangeWarning}`);
    return NextResponse.json({ user: userSessionData, showPasswordChangeWarning });

  } catch (error: any) {
    console.error('[API Login] Error during login:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
