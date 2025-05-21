/**
 * @file Middleware для обработки запросов Next.js.
 * Отвечает за проверку аутентификации пользователя и перенаправление
 * на соответствующие страницы (логин или главная) в зависимости от статуса аутентификации
 * и запрашиваемого маршрута.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { session } from './lib/session'; // Утилита для работы с сессиями
import type { User } from '@/types/user'; // Тип данных пользователя

/**
 * Список публичных маршрутов, доступных без аутентификации.
 */
const publicRoutes = ['/login'];

/**
 * Функция middleware, выполняющаяся для каждого соответствующего запроса.
 * @param {NextRequest} request - Объект входящего запроса.
 * @returns {Promise<NextResponse>} Объект ответа, который может быть перенаправлением или продолжением обработки запроса.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname; // Текущий путь запроса
  const isApiRoute = pathname.startsWith('/api'); // Проверка, является ли маршрут API-маршрутом

  // API-маршруты не требуют проверки аутентификации на уровне middleware,
  // так как они могут иметь свою логику защиты.
  if (isApiRoute) {
    // console.log(`[Middleware] Разрешение API-маршрута (без проверки аутентификации): ${pathname}`);
    return NextResponse.next(); // Пропускаем запрос дальше
  }

  // Проверка, является ли текущий маршрут публичным
  const isPublicRoute = publicRoutes.includes(pathname);

  let user: User | undefined;
  let sessionError = false; // Флаг для отслеживания ошибок при получении сессии

  try {
    const currentSession = await session(); // Получаем текущую сессию
    user = currentSession.user; // Извлекаем данные пользователя из сессии
    console.log(`[Middleware] Путь: ${pathname}, Пользователь из сессии: ${user?.login ?? 'нет'}, Публичный: ${isPublicRoute}`);
  } catch (error) {
      console.error(`[Middleware] Ошибка при получении сессии для ${pathname}:`, error);
      user = undefined; // Сбрасываем пользователя в случае ошибки
      sessionError = true; // Устанавливаем флаг ошибки сессии
  }

  // Если произошла ошибка сессии и маршрут не публичный, перенаправляем на страницу входа
  if (sessionError && !isPublicRoute) {
    console.log(`[Middleware] Ошибка сессии на защищенном маршруте ${pathname}. Перенаправление на /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname); // Сохраняем исходный путь для перенаправления после входа
    return NextResponse.redirect(loginUrl);
  }

  // Если пользователь аутентифицирован и пытается получить доступ к публичному маршруту (например, /login),
  // перенаправляем его на главную страницу.
  if (user && isPublicRoute) {
    console.log(`[Middleware] Аутентифицированный пользователь (${user.login}) обращается к публичному маршруту ${pathname}. Перенаправление на /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Если пользователь не аутентифицирован и пытается получить доступ к защищенному маршруту,
  // перенаправляем его на страницу входа.
  if (!user && !isPublicRoute) {
    console.log(`[Middleware] Неаутентифицированный пользователь обращается к защищенному маршруту ${pathname}. Перенаправление на /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname); // Сохраняем исходный путь
    return NextResponse.redirect(loginUrl);
  }

  // console.log(`[Middleware] Разрешение доступа к ${pathname} для пользователя: ${user?.login ?? 'неаутентифицированный'}`);
  return NextResponse.next(); // В остальных случаях пропускаем запрос дальше
}

/**
 * Конфигурация middleware.
 * matcher: Определяет, для каких маршрутов будет выполняться middleware.
 * Исключает API-маршруты, статические файлы, изображения и favicon.
 */
export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
