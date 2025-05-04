import { NextResponse } from 'next/server';
import { session } from '@/lib/session';

export async function POST() {
  try {
    const user = session().get('user');
    if (user) {
      console.log(`[API Logout] Logging out user: ${user.login}`);
    } else {
      console.log("[API Logout] No active session found to destroy.");
    }
    await session().destroy();
    return NextResponse.json({ message: 'Выход выполнен успешно' });
  } catch (error) {
    console.error('[API Logout] Error during logout:', error);
    return NextResponse.json({ error: 'Не удалось выполнить выход' }, { status: 500 });
  }
}
