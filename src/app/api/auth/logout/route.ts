
import { NextResponse } from 'next/server';
import { session, sessionOptions } from '@/lib/session'; // Import sessionOptions

export async function POST() {
  try {
    const currentSession = await session();
    const user = currentSession.user;

    if (user) {
      console.log(`[API Logout] User found in session: ${user.login}. Attempting to destroy session.`);
    } else {
      console.log("[API Logout] No active session found to destroy. This is expected if already logged out or cookie was cleared manually.");
    }
    
    console.log("[API Logout] About to call currentSession.destroy().");
    await currentSession.destroy(); // This should set the cookie to expire
    console.log("[API Logout] currentSession.destroy() called successfully. Cookie should be cleared by iron-session.");
    
    const response = NextResponse.json({ message: 'Выход выполнен успешно' });
    
    // While iron-session's destroy() should handle cookie expiration,
    // explicitly setting it again with maxAge: -1 can be a defensive measure
    // if there are doubts about destroy() behavior in some edge cases.
    // However, it's usually redundant.
    // response.cookies.set(sessionOptions.cookieName, '', { maxAge: -1, path: '/' });
    // console.log(`[API Logout] Manually set cookie ${sessionOptions.cookieName} to expire (should be redundant).`);

    return response;
  } catch (error) {
    console.error('[API Logout] Error during logout:', error);
    return NextResponse.json({ error: 'Не удалось выполнить выход' }, { status: 500 });
  }
}
