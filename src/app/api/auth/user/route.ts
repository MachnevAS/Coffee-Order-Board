import { NextResponse } from 'next/server';
import { session } from '@/lib/session';
import type { User } from '@/types/user';
import { updateUserInSheet } from '@/services/google-sheets-service'; // Import the service function

export async function GET() {
  try {
    const currentSession = await session(); // Await the session
    const user = currentSession.user; // Access user after awaiting

    if (user) {
      return NextResponse.json({ user });
    } else {
      return NextResponse.json({ user: null });
    }
  } catch (error) {
    console.error('[API User] Error fetching user session:', error);
    return NextResponse.json({ error: 'Не удалось получить данные пользователя' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionData = await session(); 
    const currentUserSession = sessionData.user; 

    if (!currentUserSession) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const updates: Partial<User> = await request.json();

    // Validate updates (ensure critical fields like ID are not changed arbitrarily)
    // Allow login, FIO, position, iconColor to be updated. Password change is a separate endpoint.
    const allowedUpdates: Partial<User> = {
        login: updates.login || undefined, // login can be updated
        firstName: updates.firstName || undefined, 
        middleName: updates.middleName || undefined,
        lastName: updates.lastName || undefined,
        position: updates.position || undefined,
        iconColor: updates.iconColor || undefined,
    };

    // Filter out undefined values before sending to sheet service
    const validUpdates = Object.entries(allowedUpdates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key as keyof Partial<User>] = value;
        }
        return acc;
    }, {} as Partial<User>);

    // Update the user data in Google Sheet
    // Pass the original login from the session to identify the user in the sheet,
    // as the login itself might be part of the updates.
    if (Object.keys(validUpdates).length > 0) {
        console.log(`[API User PUT] Updating user (original login: ${currentUserSession.login}) in sheet with:`, validUpdates);
        const updateSuccess = await updateUserInSheet(currentUserSession.login, validUpdates);

        if (!updateSuccess) {
            console.error(`[API User PUT] Failed to update user ${currentUserSession.login} in Google Sheet.`);
            return NextResponse.json({ error: 'Не удалось обновить данные пользователя в таблице' }, { status: 500 });
        }
        console.log(`[API User PUT] Successfully updated user ${currentUserSession.login} in Google Sheet.`);
    } else {
         console.log(`[API User PUT] No valid updates provided for user ${currentUserSession.login}. Skipping sheet update.`);
    }


    // Update the session data
    // Important: The ID from the original session user should be preserved if it's not part of 'validUpdates'
    // and if your User type in session relies on a persistent ID.
    const updatedUserInSession = { ...currentUserSession, ...validUpdates };
    sessionData.user = updatedUserInSession;
    await sessionData.save();
    console.log(`[API User PUT] Session updated for user (new login if changed: ${updatedUserInSession.login}).`);

    return NextResponse.json({ user: updatedUserInSession });

  } catch (error) {
    console.error('[API User PUT] Error updating user:', error);
    return NextResponse.json({ error: 'Не удалось обновить данные пользователя' }, { status: 500 });
  }
}
