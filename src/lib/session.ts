import { getIronSession, IronSessionData } from 'iron-session';
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

export function session() {
    if (!process.env.IRON_SESSION_PASSWORD) {
        throw new Error("IRON_SESSION_PASSWORD environment variable is not set.");
    }
    return getIronSession<IronSessionData>(cookies(), sessionOptions);
}
