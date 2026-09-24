import { NextResponse } from 'next/server';

// Esta es una primera barrera de navegación. La API vuelve a validar el JWT
// antes de cualquier operación sensible, así que aquí sólo cuidamos la UX.
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/app')) {
    // La cookie existe para que el middleware pueda decidir antes de renderizar.
    // Los datos completos de la sesión se administran en AuthContext.
    const token = request.cookies.get('rolling_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

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
