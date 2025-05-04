import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { session } from './lib/session';
import type { User } from '@/types/user'; // Import User type

// Define public routes (accessible without authentication)
const publicRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api'); // Check if it's an API route

  // Allow all API routes to pass through without auth check in middleware
  if (isApiRoute) {
    // console.log("[Middleware] Allowing API route:", pathname);
    return NextResponse.next();
  }

  // Check if the current route is public
  const isPublicRoute = publicRoutes.includes(pathname);

  // Get session data
  let user: User | undefined;
  try {
    const currentSession = await session(); // Await the session function
    user = currentSession.user; // Access user directly after awaiting session
    // console.log(`[Middleware] Session check for ${pathname}. User found:`, !!user);
  } catch (error) {
      console.error("[Middleware] Error fetching session:", error);
      // Treat session error as unauthenticated for protected routes
      user = undefined;
  }


  // --- Redirection Logic ---

  // 1. Authenticated user tries to access a public route (e.g., /login)
  if (user && isPublicRoute) {
    console.log(`[Middleware] Authenticated user (${user.login}) accessing public route ${pathname}. Redirecting to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Unauthenticated user tries to access a protected route
  if (!user && !isPublicRoute) {
    console.log(`[Middleware] Unauthenticated user accessing protected route ${pathname}. Redirecting to /login`);
    // Add the original path as a query parameter for potential redirection after login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname); // Store original path
    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to proceed if none of the above conditions are met
  // console.log(`[Middleware] Allowing access to ${pathname} for user:`, user?.login ?? 'unauthenticated');
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  // Matcher excludes specific Next.js internal paths and static assets
  // It now includes API routes in the exclusion as they are handled separately
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled above)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - specific assets like .png, .jpg etc. if needed
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
