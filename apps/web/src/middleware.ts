import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  absoluteUrl,
  decodeJwtPayload,
  homeForRole,
  isAccessValid,
  isPublicPath,
  roleAllowedOnPath,
} from '@/lib/auth.ts';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const claims = token ? decodeJwtPayload(token) : null;
  const signedIn = isAccessValid(claims);

  if (!signedIn) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const refreshUrl = absoluteUrl(request, '/api/v0/auth/refresh');
    refreshUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(refreshUrl);
  }

  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(absoluteUrl(request, homeForRole(claims.role)));
  }

  if (!roleAllowedOnPath(claims.role, pathname)) {
    return NextResponse.redirect(absoluteUrl(request, homeForRole(claims.role)));
  }

  return NextResponse.next();
}
