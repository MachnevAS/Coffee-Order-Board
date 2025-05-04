import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { session } from './lib/session';
import type { User } from '@/types/user'; // Import User type

// Define public routes (accessible without authentication)
const publicRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if the current route is public
  const isPublicRoute = publicRoutes.includes(pathname);

  // Get session data
  const currentSession = await session(); // Await the session function
  const user = currentSession.user; // Access user directly after awaiting session

  // Redirect authenticated users trying to access login page
  if (user && isPublicRoute) {
    console.log("[Middleware] Authenticated user accessing public route, redirecting to /");
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect unauthenticated users trying to access protected routes
  if (!user && !isPublicRoute) {
    console.log(`[Middleware] Unauthenticated user accessing protected route ${pathname}, redirecting to /login`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request to proceed if none of the above conditions are met
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  // Matcher excludes API routes, static files, and image optimization routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
