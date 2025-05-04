import { getIronSession, IronSession, IronSessionData } from 'iron-session';
import { cookies } from 'next/headers';
import type { User } from '@/types/user';

declare module 'iron-session' {
  interface IronSessionData {
    user?: User;
  }
}

export const sessionOptions = {
  password: process.env.IRON_SESSION_PASSWORD as string,
  cookieName: 'coffee-app-session',
  // secure: true should be used in production (HTTPS)
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

// Make the session function async
export async function session(): Promise<IronSession<IronSessionData>> {
    if (!process.env.IRON_SESSION_PASSWORD) {
        throw new Error("IRON_SESSION_PASSWORD environment variable is not set.");
    }
    // getIronSession returns a Promise, so we need to await it
    return getIronSession<IronSessionData>(cookies(), sessionOptions);
}
