import { absoluteUrl, safeNextPath } from '@/lib/auth.ts';
import { getApiUrl } from '@/lib/format.ts';
import { NextRequest, NextResponse } from 'next/server';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
]);

type RouteContext = { params: Promise<{ path: string[] }> };

async function bounceRefresh(request: NextRequest): Promise<NextResponse> {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const login = absoluteUrl(request, '/login');
  const cookie = request.headers.get('cookie') ?? '';
  if (!cookie.includes('refresh_token=')) {
    return NextResponse.redirect(login);
  }

  const upstream = await fetch(`${getApiUrl()}/api/v0/auth/refresh`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });

  if (!upstream.ok) {
    return NextResponse.redirect(login);
  }

  const response = NextResponse.redirect(absoluteUrl(request, next));
  copySetCookies(upstream, response);
  return response;
}

function copySetCookies(from: Response, to: NextResponse): void {
  const cookies =
    typeof from.headers.getSetCookie === 'function'
      ? from.headers.getSetCookie()
      : [];
  for (const cookie of cookies) {
    to.headers.append('set-cookie', cookie);
  }
}

async function proxy(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { path } = await context.params;
  const segments = path ?? [];

  if (
    request.method === 'GET' &&
    segments[0] === 'auth' &&
    segments[1] === 'refresh'
  ) {
    return bounceRefresh(request);
  }

  const target = new URL(
    `/api/v0/${segments.join('/')}${request.nextUrl.search}`,
    getApiUrl()
  );

  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const upstream = await fetch(target, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === 'set-cookie') return;
    responseHeaders.set(key, value);
  });

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  copySetCookies(upstream, response);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
