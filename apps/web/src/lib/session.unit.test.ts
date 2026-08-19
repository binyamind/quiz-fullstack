import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors.ts';

const store = {
  get: vi.fn(),
  getAll: vi.fn(() => []),
  set: vi.fn(),
};
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('next/headers', () => ({
  cookies: async () => store,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
  notFound: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});

vi.mock('./api.ts', () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import('./api.ts');
const { applySetCookies, getSession, requireSession } = await import(
  './session.ts'
);

describe('getSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without an access cookie', async () => {
    store.get.mockReturnValue(undefined);
    await expect(getSession()).resolves.toBeNull();
  });

  it('returns the user and treats 401 as signed out', async () => {
    store.get.mockReturnValue({ value: 'tok' });
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', role: 'admin' });
    await expect(getSession()).resolves.toMatchObject({ id: '1' });

    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'no')
    );
    await expect(getSession()).resolves.toBeNull();
  });

  it('rethrows unexpected errors', async () => {
    store.get.mockReturnValue({ value: 'tok' });
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    await expect(getSession()).rejects.toThrow('boom');
  });
});

describe('requireSession', () => {
  it('redirects when missing', async () => {
    store.get.mockReturnValue(undefined);
    await expect(requireSession()).rejects.toThrow('REDIRECT:/login');
  });

  it('returns the user when present', async () => {
    store.get.mockReturnValue({ value: 'tok' });
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', role: 'student' });
    await expect(requireSession()).resolves.toMatchObject({ id: '1' });
  });
});

describe('applySetCookies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies Set-Cookie headers onto the store', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'access_token=abc; Path=/; HttpOnly');
    const response = new Response(null, { headers });
    await applySetCookies(response);
    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'access_token', value: 'abc' })
    );
  });

  it('no-ops when getSetCookie is absent', async () => {
    const response = {
      headers: {},
    } as Response;
    await applySetCookies(response);
    expect(store.set).not.toHaveBeenCalled();
  });
});
