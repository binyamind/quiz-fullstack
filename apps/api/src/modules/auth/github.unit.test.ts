import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../shared/errors.ts';
import { createGitHubProvider } from './github.ts';

const CONFIG = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:4000/callback',
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    async json() {
      return body;
    },
  } as Response;
}

/** Serves one queued response per call, in order. */
function fetchSequence(...responses: Response[]) {
  const queue = [...responses];
  return vi.fn(async () => queue.shift() ?? jsonResponse({}, false));
}

const tokenOk = () => jsonResponse({ access_token: 'gho_token' });

describe('authorizeUrl', () => {
  it('builds the GitHub consent url with the configured client and state', () => {
    const url = new URL(
      createGitHubProvider({
        ...CONFIG,
        fetchImpl: fetchSequence(),
      }).authorizeUrl('state-123')
    );

    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize'
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      redirect_uri: 'http://localhost:4000/callback',
      scope: 'read:user user:email',
      state: 'state-123',
    });
  });

  it('names itself github', () => {
    expect(createGitHubProvider(CONFIG).name).toBe('github');
  });
});

describe('exchange', () => {
  it('returns a normalised profile from the token and user calls', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({
        id: 42,
        login: 'octocat',
        name: 'Octo Cat',
        email: 'Octo@Example.COM',
      })
    );

    const profile = await createGitHubProvider({
      ...CONFIG,
      fetchImpl,
    }).exchange('code-1');

    expect(profile).toEqual({
      providerUserId: '42',
      email: 'octo@example.com',
      name: 'Octo Cat',
    });
  });

  it('posts the code and secret to the token endpoint', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 1, login: 'octocat', name: 'Octo', email: 'o@e.test' })
    );

    await createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('code-1');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'http://localhost:4000/callback',
      code: 'code-1',
    });
  });

  it('falls back to the login when the profile has no display name', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 7, login: 'octocat', name: null, email: 'o@e.test' })
    );

    const profile = await createGitHubProvider({
      ...CONFIG,
      fetchImpl,
    }).exchange('code-1');

    expect(profile.name).toBe('octocat');
  });

  it('rejects a code GitHub will not trade', async () => {
    const fetchImpl = fetchSequence(jsonResponse({}, false));

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('bad-code')
    ).rejects.toThrow(
      new UnauthorizedError('GitHub rejected the authorization code')
    );
  });

  it('surfaces the error description when no access token comes back', async () => {
    const fetchImpl = fetchSequence(
      jsonResponse({ error_description: 'The code passed is incorrect.' })
    );

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('bad-code')
    ).rejects.toThrow('The code passed is incorrect.');
  });

  it('uses a generic message when the token error has no description', async () => {
    const fetchImpl = fetchSequence(jsonResponse({}));

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('bad-code')
    ).rejects.toThrow('GitHub returned no access token');
  });

  it('rejects when the profile call fails', async () => {
    const fetchImpl = fetchSequence(tokenOk(), jsonResponse({}, false));

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('code-1')
    ).rejects.toThrow('Could not read the GitHub profile');
  });

  it('sends the bearer token on the profile call', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 1, login: 'octocat', name: 'Octo', email: 'o@e.test' })
    );

    await createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('code-1');

    const [url, init] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer gho_token'
    );
  });

  it('prefers the primary verified address when the profile hides its email', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 9, login: 'octocat', name: 'Octo', email: null }),
      jsonResponse([
        { email: 'secondary@e.test', primary: false, verified: true },
        { email: 'Primary@E.test', primary: true, verified: true },
      ])
    );

    const profile = await createGitHubProvider({
      ...CONFIG,
      fetchImpl,
    }).exchange('code-1');

    expect(profile.email).toBe('primary@e.test');
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(
      'https://api.github.com/user/emails'
    );
  });

  it('accepts any verified address when none is marked primary', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 9, login: 'octocat', name: 'Octo', email: null }),
      jsonResponse([
        { email: 'unverified@e.test', primary: true, verified: false },
        { email: 'verified@e.test', primary: false, verified: true },
      ])
    );

    const profile = await createGitHubProvider({
      ...CONFIG,
      fetchImpl,
    }).exchange('code-1');

    expect(profile.email).toBe('verified@e.test');
  });

  it('rejects an account whose addresses are all unverified', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 9, login: 'octocat', name: 'Octo', email: null }),
      jsonResponse([
        { email: 'unverified@e.test', primary: true, verified: false },
      ])
    );

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('code-1')
    ).rejects.toThrow('This GitHub account exposes no verified email address');
  });

  it('rejects when the email list itself cannot be read', async () => {
    const fetchImpl = fetchSequence(
      tokenOk(),
      jsonResponse({ id: 9, login: 'octocat', name: 'Octo', email: null }),
      jsonResponse([], false)
    );

    await expect(
      createGitHubProvider({ ...CONFIG, fetchImpl }).exchange('code-1')
    ).rejects.toThrow('This GitHub account exposes no verified email address');
  });

  it('uses the global fetch when no implementation is injected', async () => {
    const globalFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({}, false));

    await expect(
      createGitHubProvider(CONFIG).exchange('code-1')
    ).rejects.toThrow('GitHub rejected the authorization code');
    expect(globalFetch).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.objectContaining({ method: 'POST' })
    );

    globalFetch.mockRestore();
  });
});
