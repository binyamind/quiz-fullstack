import { UnauthorizedError } from '../../shared/errors.ts';

export interface OAuthProfile {
  providerUserId: string;
  email: string;
  name: string;
}

export interface OAuthProvider {
  name: string;
  authorizeUrl(state: string): string;
  exchange(code: string): Promise<OAuthProfile>;
}

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Injectable so tests can drive the flow without network access. */
  fetchImpl?: typeof fetch;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * GitHub OAuth by hand: `@fastify/oauth2` is not in the locked dependency list,
 * and GitHub's flow needs no OIDC discovery — two `fetch` calls cover it.
 */
export function createGitHubProvider(config: GitHubConfig): OAuthProvider {
  const doFetch = config.fetchImpl ?? fetch;

  return {
    name: 'github',

    authorizeUrl(state) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params.toString()}`;
    },

    async exchange(code) {
      const tokenResponse = await doFetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            code,
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new UnauthorizedError('GitHub rejected the authorization code');
      }

      const tokenBody = (await tokenResponse.json()) as {
        access_token?: string;
        error_description?: string;
      };
      if (!tokenBody.access_token) {
        throw new UnauthorizedError(
          tokenBody.error_description ?? 'GitHub returned no access token'
        );
      }

      const headers = {
        authorization: `Bearer ${tokenBody.access_token}`,
        accept: 'application/vnd.github+json',
      };

      const userResponse = await doFetch('https://api.github.com/user', {
        headers,
      });
      if (!userResponse.ok) {
        throw new UnauthorizedError('Could not read the GitHub profile');
      }
      const user = (await userResponse.json()) as GitHubUser;

      // A GitHub profile may hide its email, so fall back to the verified list.
      let email = user.email;
      if (!email) {
        const emailResponse = await doFetch(
          'https://api.github.com/user/emails',
          {
            headers,
          }
        );
        if (emailResponse.ok) {
          const emails = (await emailResponse.json()) as GitHubEmail[];
          email =
            emails.find((e) => e.primary && e.verified)?.email ??
            emails.find((e) => e.verified)?.email ??
            null;
        }
      }

      if (!email) {
        throw new UnauthorizedError(
          'This GitHub account exposes no verified email address'
        );
      }

      return {
        providerUserId: String(user.id),
        email: email.toLowerCase(),
        name: user.name ?? user.login,
      };
    },
  };
}
