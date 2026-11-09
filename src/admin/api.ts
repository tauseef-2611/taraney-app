// Tiny fetch wrapper for the admin API. Throws Error(message) on failure; 401 sends you to login.
export class AuthError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const res = await fetch(`/api${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AuthError(data.error || 'Not signed in');
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(p: string) => call<T>('GET', p),
  post: <T>(p: string, b?: unknown) => call<T>('POST', p, b ?? {}),
  put: <T>(p: string, b: unknown) => call<T>('PUT', p, b),
  del: <T>(p: string) => call<T>('DELETE', p),
};

export interface SongListItem {
  id: string; slug: string; publish_state: string; reviewed: boolean; title_ur: string | null; title_ro: string | null;
  genre: string | null; mood: string | null; issues: string[]; updated_at: string; rec_count: number; synced: boolean;
}
