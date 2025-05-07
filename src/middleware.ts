import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { session } from './lib/session';
import type { User } from '@/types/user'; // Import User type

// Define public routes (accessible without authentication)
const publicRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api'); 

  if (isApiRoute) {
    // console.log(`[Middleware] Allowing API route (no auth check): ${pathname}`);
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(pathname);

  let user: User | undefined;
  let sessionError = false;
  try {
    const currentSession = await session(); 
    user = currentSession.user; 
    console.log(`[Middleware] Path: ${pathname}, User from session: ${user?.login ?? 'none'}, IsPublic: ${isPublicRoute}`);
  } catch (error) {
      console.error(`[Middleware] Error fetching session for ${pathname}:`, error);
      user = undefined;
      sessionError = true; 
  }

  if (sessionError && !isPublicRoute) {
    console.log(`[Middleware] Session error on protected route ${pathname}. Redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicRoute) {
    console.log(`[Middleware] Authenticated user (${user.login}) accessing public route ${pathname}. Redirecting to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && !isPublicRoute) {
    console.log(`[Middleware] Unauthenticated user accessing protected route ${pathname}. Redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname); 
    return NextResponse.redirect(loginUrl);
  }

  // console.log(`[Middleware] Allowing access to ${pathname} for user: ${user?.login ?? 'unauthenticated'}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
