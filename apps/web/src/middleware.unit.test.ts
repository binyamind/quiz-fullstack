import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { fakeAccess } from './test/helpers.ts';
import { middleware, config } from './middleware.ts';

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('middleware', () => {
  it('exposes a matcher that skips api and static assets', () => {
    expect(config.matcher[0]).toContain('api');
  });

  it('lets anonymous users reach login', () => {
    const response = middleware(request('/login'));
    expect(response.status).toBe(200);
  });

  it('bounces anonymous users through refresh', () => {
    const response = middleware(request('/admin/users?q=1'));
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/api/v0/auth/refresh?next=%2Fadmin%2Fusers%3Fq%3D1'
    );
  });

  it('does not redirect to the container bind address behind a proxy', () => {
    const proxied = new NextRequest('http://0.0.0.0:3000/', {
      headers: {
        host: '0.0.0.0:3000',
        'x-forwarded-host': 'quiz-fullstack.duckdns.org',
        'x-forwarded-proto': 'https',
      },
    });
    expect(middleware(proxied).headers.get('location')).toBe(
      'https://quiz-fullstack.duckdns.org/api/v0/auth/refresh?next=%2F'
    );
  });

  it('sends a signed-in user home from login and /', () => {
    const cookie = `access_token=${fakeAccess('student')}`;
    expect(middleware(request('/login', cookie)).headers.get('location')).toBe(
      'http://localhost:3000/my'
    );
    expect(middleware(request('/', cookie)).headers.get('location')).toBe(
      'http://localhost:3000/my'
    );
  });

  it('redirects the wrong role to their own hall', () => {
    const cookie = `access_token=${fakeAccess('teacher')}`;
    expect(
      middleware(request('/admin', cookie)).headers.get('location')
    ).toBe('http://localhost:3000/teach');
  });

  it('allows a valid role through', () => {
    const cookie = `access_token=${fakeAccess('admin')}`;
    expect(middleware(request('/admin/users', cookie)).status).toBe(200);
  });

  it('treats an expired token as signed out', () => {
    const cookie = `access_token=${fakeAccess('admin', -20)}`;
    expect(middleware(request('/admin', cookie)).headers.get('location')).toContain(
      '/api/v0/auth/refresh'
    );
  });
});
