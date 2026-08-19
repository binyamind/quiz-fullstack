import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  decodeJwtPayload,
  homeForRole,
  isAccessValid,
  isPublicPath,
  publicOrigin,
  roleAllowedOnPath,
  safeNextPath,
} from './auth.ts';
import { fakeAccess, fakeJwt } from '../test/helpers.ts';

describe('homeForRole', () => {
  it('routes each role to its hall', () => {
    expect(homeForRole('admin')).toBe('/admin');
    expect(homeForRole('teacher')).toBe('/teach');
    expect(homeForRole('student')).toBe('/my');
  });
});

describe('roleAllowedOnPath', () => {
  it('gates role prefixes and allows shared paths', () => {
    expect(roleAllowedOnPath('admin', '/admin/users')).toBe(true);
    expect(roleAllowedOnPath('teacher', '/admin')).toBe(false);
    expect(roleAllowedOnPath('admin', '/teach')).toBe(true);
    expect(roleAllowedOnPath('teacher', '/teach')).toBe(true);
    expect(roleAllowedOnPath('student', '/teach')).toBe(false);
    expect(roleAllowedOnPath('student', '/my/work')).toBe(true);
    expect(roleAllowedOnPath('admin', '/my')).toBe(false);
    expect(roleAllowedOnPath('teacher', '/login')).toBe(true);
    expect(roleAllowedOnPath('student', '/unknown')).toBe(true);
  });
});

describe('isPublicPath', () => {
  it('only login is public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/admin')).toBe(false);
  });
});

describe('publicOrigin', () => {
  it('prefers forwarded host and proto over the listen address', () => {
    const request = {
      url: 'http://0.0.0.0:3000/admin',
      headers: new Headers({
        host: '0.0.0.0:3000',
        'x-forwarded-host': 'quiz-fullstack.duckdns.org',
        'x-forwarded-proto': 'https',
      }),
    };
    expect(publicOrigin(request)).toBe('https://quiz-fullstack.duckdns.org');
    expect(
      absoluteUrl(request, '/login').href
    ).toBe('https://quiz-fullstack.duckdns.org/login');
  });

  it('falls back to Host when forwarded headers are absent', () => {
    const request = {
      url: 'http://0.0.0.0:3000/login',
      headers: new Headers({ host: 'localhost:3000' }),
    };
    expect(publicOrigin(request)).toBe('http://localhost:3000');
  });

  it('ignores the bind address and unknown forwarded proto', () => {
    expect(
      publicOrigin({
        url: 'http://0.0.0.0:3000/x',
        headers: new Headers({
          host: '0.0.0.0:3000',
          'x-forwarded-proto': 'wss',
        }),
      })
    ).toBe('http://0.0.0.0:3000');
    expect(
      publicOrigin({
        url: 'https://0.0.0.0:3000/x',
        headers: new Headers({
          host: 'school.test',
          'x-forwarded-proto': 'wss',
        }),
      })
    ).toBe('https://school.test');
    expect(
      publicOrigin({
        url: 'https://localhost:3000/x',
        headers: new Headers({
          'x-forwarded-host': ' a.example, b.example ',
          'x-forwarded-proto': 'https, http',
        }),
      })
    ).toBe('https://a.example');
    expect(
      publicOrigin({
        url: 'http://localhost:3000/x',
        headers: new Headers({ host: '  ' }),
      })
    ).toBe('http://localhost:3000');
  });
});

describe('safeNextPath', () => {
  it('rejects open redirects', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('https://evil.test')).toBe('/');
    expect(safeNextPath('//evil.test')).toBe('/');
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/teach/classes/1')).toBe('/teach/classes/1');
  });
});

describe('decodeJwtPayload', () => {
  it('reads a valid access token and rejects junk', () => {
    const token = fakeAccess('teacher');
    expect(decodeJwtPayload(token)?.role).toBe('teacher');
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.!!!')).toBeNull();
    expect(decodeJwtPayload(fakeJwt({ sub: 'x', role: 'nope' }))).toBeNull();
    expect(decodeJwtPayload(fakeJwt({ role: 'admin' }))).toBeNull();
  });

  it('falls back to Buffer when atob is missing', () => {
    const original = globalThis.atob;
    // @ts-expect-error -- coverage for the Node path
    delete globalThis.atob;
    try {
      expect(decodeJwtPayload(fakeAccess('admin'))?.role).toBe('admin');
    } finally {
      globalThis.atob = original;
    }
  });
});

describe('isAccessValid', () => {
  it('requires a live access token', () => {
    expect(isAccessValid(null)).toBe(false);
    expect(
      isAccessValid(decodeJwtPayload(fakeJwt({ sub: '1', role: 'admin', typ: 'refresh' })))
    ).toBe(false);
    expect(isAccessValid(decodeJwtPayload(fakeAccess('admin', -10)))).toBe(false);
    expect(isAccessValid(decodeJwtPayload(fakeAccess('admin')))).toBe(true);
    expect(
      isAccessValid(decodeJwtPayload(fakeJwt({ sub: '1', role: 'student' })))
    ).toBe(true);
  });
});
