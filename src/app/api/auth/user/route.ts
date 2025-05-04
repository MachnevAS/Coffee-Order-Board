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
    const sessionData = await session(); // Await the session
    const currentUser = sessionData.user; // Access user after awaiting

    if (!currentUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const updates: Partial<User> = await request.json();

    // Validate updates (ensure critical fields like ID/login are not changed arbitrarily)
    const allowedUpdates: Partial<User> = {
        firstName: updates.firstName || undefined, // Use undefined if empty string
        middleName: updates.middleName || undefined,
        lastName: updates.lastName || undefined,
        // Potentially allow password updates here if implementing password change
        // iconColor: updates.iconColor, // Maybe allow color change?
    };

    // Filter out undefined values before sending to sheet service
    const validUpdates = Object.entries(allowedUpdates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key as keyof Partial<User>] = value;
        }
        return acc;
    }, {} as Partial<User>);

    // Update the user data in Google Sheet
    if (Object.keys(validUpdates).length > 0) {
        console.log(`[API User PUT] Updating user ${currentUser.login} in sheet with:`, validUpdates);
        const updateSuccess = await updateUserInSheet(currentUser.login, validUpdates);

        if (!updateSuccess) {
            console.error(`[API User PUT] Failed to update user ${currentUser.login} in Google Sheet.`);
            return NextResponse.json({ error: 'Не удалось обновить данные пользователя в таблице' }, { status: 500 });
        }
        console.log(`[API User PUT] Successfully updated user ${currentUser.login} in Google Sheet.`);
    } else {
         console.log(`[API User PUT] No valid updates provided for user ${currentUser.login}. Skipping sheet update.`);
    }


    // Update the session data
    const updatedUser = { ...currentUser, ...allowedUpdates }; // Apply updates (including potential undefined) locally
    sessionData.user = updatedUser;
    await sessionData.save();
    console.log(`[API User PUT] Session updated for user ${currentUser.login}.`);

    return NextResponse.json({ user: updatedUser });

  } catch (error) {
    console.error('[API User PUT] Error updating user:', error);
    return NextResponse.json({ error: 'Не удалось обновить данные пользователя' }, { status: 500 });
  }
}
