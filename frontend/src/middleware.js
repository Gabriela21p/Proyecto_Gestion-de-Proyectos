import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/app')) {
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
