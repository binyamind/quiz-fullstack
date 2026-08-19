import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors.ts';

const cookiesMock = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: (url: string) => redirect(url),
}));

const { apiFetch, apiMutate, apiRequest, errorFromPayload, readPayload } =
  await import('./api.ts');

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      getAll: () => [{ name: 'access_token', value: 'tok' }],
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('forwards cookies and returns JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { id: '1' }));
    await expect(apiFetch('/users/1')).resolves.toEqual({ id: '1' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v0/users/1',
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: 'access_token=tok' }),
      })
    );
  });

  it('omits cookies when none exist and sends JSON bodies', async () => {
    cookiesMock.mockResolvedValue({ getAll: () => [] });
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { ok: true }));
    await apiFetch('/users', { method: 'POST', body: { name: 'Ada' } });
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ name: 'Ada' }));
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json'
    );
  });

  it('uses an explicit cookie override, including clearing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/auth/logout', { cookie: '' })).resolves.toBeUndefined();
    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers.cookie).toBeUndefined();
  });

  it('maps 404 and 401 unless skipMap is set', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'gone' } })
      )
    );
    await expect(apiFetch('/x')).rejects.toThrow('NOT_FOUND');
    await expect(apiFetch('/x', { skipMap: true })).rejects.toBeInstanceOf(ApiError);

    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'nope' } })
      )
    );
    await expect(apiFetch('/me')).rejects.toThrow('REDIRECT:/login');
  });

  it('throws other errors and handles non-json bodies', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('plain', { status: 500 }))
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({
      message: 'Request failed',
      status: 500,
    });
    await expect(apiMutate('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('parses error envelopes without a code', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(403, { error: { message: 'no' } })
    );
    await expect(apiFetch('/x', { skipMap: true })).rejects.toMatchObject({
      code: 'ERROR',
      message: 'no',
    });
  });
});

describe('errorFromPayload and readPayload', () => {
  it('covers malformed envelopes', () => {
    expect(errorFromPayload(400, null).message).toBe('Request failed');
    expect(errorFromPayload(400, { error: { code: 'X' } }).message).toBe(
      'Request failed'
    );
  });

  it('returns undefined for empty bodies', async () => {
    expect(await readPayload(new Response('', { status: 200 }))).toBeUndefined();
  });
});

describe('apiRequest', () => {
  it('hits the configured API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    cookiesMock.mockResolvedValue({ getAll: () => [] });
    const response = await apiRequest('/auth/refresh', { method: 'POST' });
    expect(response.status).toBe(204);
  });
});
