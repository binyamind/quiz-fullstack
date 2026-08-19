import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ApiError } from './errors.ts';
import { getApiUrl } from './format.ts';
import type { ApiErrorBody } from './types.ts';

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  cookie?: string;
  /** When true, 401/404 stay as thrown ApiError instead of navigation. */
  skipMap?: boolean;
}

async function cookieHeader(explicit?: string): Promise<string | undefined> {
  if (explicit !== undefined) return explicit || undefined;
  const store = await cookies();
  const pairs = store.getAll().map((entry) => `${entry.name}=${entry.value}`);
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

export function errorFromPayload(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const body = payload as ApiErrorBody;
    const error = body.error;
    if (error && typeof error.message === 'string') {
      return new ApiError(
        status,
        error.code ?? 'ERROR',
        error.message,
        error.details
      );
    }
  }
  return new ApiError(status, 'ERROR', 'Request failed');
}

function mapStatus(error: ApiError): never {
  if (error.status === 404) notFound();
  if (error.status === 401) redirect('/login');
  throw error;
}

export async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { body, cookie, skipMap: _skipMap, headers, ...init } = options;
  const cookieValue = await cookieHeader(cookie);
  const hasBody = body !== undefined;
  return fetch(`${getApiUrl()}/api/v0${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(cookieValue ? { cookie: cookieValue } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const response = await apiRequest(path, options);
  if (response.status === 204) return undefined as T;

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = errorFromPayload(response.status, payload);
    if (!options.skipMap) mapStatus(error);
    throw error;
  }

  return payload as T;
}

export async function apiMutate<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  return apiFetch<T>(path, { ...options, skipMap: true });
}
