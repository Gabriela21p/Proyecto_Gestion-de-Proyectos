import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Rutas públicas - permitir acceso sin token
  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Rutas protegidas - verificar token
  if (pathname.startsWith('/app')) {
    const token = request.cookies.get('rolling_token')?.value;

    if (!token) {
      // Si no hay token en cookies, intentar obtener de localStorage (no disponible en middleware)
      // Redirigir a login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Raíz redirige a /app o /login según tenga sesión
  if (pathname === '/') {
    const token = request.cookies.get('rolling_token')?.value;
    const redirectPath = token ? '/app' : '/login';
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/app/:path*', '/login', '/register'],
};
