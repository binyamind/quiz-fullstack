export interface CookieToSet {
  name: string;
  value: string;
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

export function parseSetCookieHeader(header: string): CookieToSet | null {
  const parts = header.split(';').map((part) => part.trim());
  const first = parts[0];
  if (!first) return null;
  const eq = first.indexOf('=');
  if (eq <= 0) return null;

  const cookie: CookieToSet = {
    name: first.slice(0, eq),
    value: first.slice(eq + 1),
  };

  for (const attr of parts.slice(1)) {
    const [rawKey, ...rest] = attr.split('=');
    if (!rawKey) continue;
    const key = rawKey.trim().toLowerCase();
    const rawValue = rest.join('=').trim();
    if (key === 'path') cookie.path = rawValue || '/';
    else if (key === 'max-age') {
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) cookie.maxAge = parsed;
    } else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'samesite') {
      const mode = rawValue.toLowerCase();
      if (mode === 'lax' || mode === 'strict' || mode === 'none') {
        cookie.sameSite = mode;
      }
    }
  }

  return cookie;
}

export function parseSetCookieHeaders(headers: string[]): CookieToSet[] {
  const cookies: CookieToSet[] = [];
  for (const header of headers) {
    const parsed = parseSetCookieHeader(header);
    if (parsed) cookies.push(parsed);
  }
  return cookies;
}
