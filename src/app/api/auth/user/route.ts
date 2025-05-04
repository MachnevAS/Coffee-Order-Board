import { NextResponse } from 'next/server';
import { session } from '@/lib/session';
import type { User } from '@/types/user';

export async function GET() {
  try {
    const user = session().get<User>('user');

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
    const sessionData = session();
    const currentUser = sessionData.get<User>('user');

    if (!currentUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const updates: Partial<User> = await request.json();

    // Validate updates (ensure critical fields like ID/login are not changed arbitrarily)
    const allowedUpdates: Partial<User> = {
        firstName: updates.firstName,
        middleName: updates.middleName,
        lastName: updates.lastName,
        // Potentially allow password updates here if implementing password change
        // iconColor: updates.iconColor, // Maybe allow color change?
    };

    // Update the user data in Google Sheet
    // This requires the `updateUserInSheet` function to be implemented
    // Assuming `updateUserInSheet` takes the login and the partial updates
    /*
    const updateSuccess = await updateUserInSheet(currentUser.login, allowedUpdates);

    if (!updateSuccess) {
        return NextResponse.json({ error: 'Не удалось обновить данные пользователя в таблице' }, { status: 500 });
    }
    */

     // Temporary placeholder until updateUserInSheet is implemented
    console.warn("[API User PUT] updateUserInSheet is not implemented. Skipping sheet update.");
    const updateSuccess = true; // Assume success for now

    if (!updateSuccess) {
        return NextResponse.json({ error: 'Не удалось обновить данные пользователя в таблице' }, { status: 500 });
    }


    // Update the session data
    const updatedUser = { ...currentUser, ...allowedUpdates };
    sessionData.set('user', updatedUser);
    await sessionData.save();

    return NextResponse.json({ user: updatedUser });

  } catch (error) {
    console.error('[API User PUT] Error updating user:', error);
    return NextResponse.json({ error: 'Не удалось обновить данные пользователя' }, { status: 500 });
  }
}
