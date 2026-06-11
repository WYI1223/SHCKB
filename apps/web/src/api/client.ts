/** Typed fetch wrappers for the notepage API (plan contract C3). */

export type NotepageSummary = {
  id: string;
  slug: string;
  title: string;
  visibility: 'private' | 'public';
  hasPublished: boolean;
  updatedAt: number;
};

export type WorkingBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  content: unknown;
};

export type NotepageDetail = {
  page: {
    id: string;
    slug: string;
    title: string;
    visibility: 'private' | 'public';
    gravityEnabled: boolean;
    hasPublished: boolean;
    updatedAt: number;
  };
  blocks: WorkingBlock[];
};

export type PublishedDoc = {
  title: string;
  gravityEnabled: boolean;
  blocks: WorkingBlock[];
  publishedAt: number;
};

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // Session expired/absent on an authenticated surface → login page.
    if (res.status === 401 && !path.startsWith('/api/auth') && !path.startsWith('/api/public')) {
      window.location.href = '/login';
    }
    throw new ApiError(
      res.status,
      typeof body.error === 'string' ? body.error : `request failed (${res.status})`,
      Array.isArray(body.details) ? (body.details as string[]) : undefined,
    );
  }
  return body as T;
}

export type Me = { id: string; role: 'admin' | 'author'; name: string; email: string };

export type TreeFolder = { id: string; name: string; parentId: string | null; sortKey: number };
export type TreePage = {
  id: string;
  slug: string;
  title: string;
  visibility: 'private' | 'public';
  hasPublished: boolean;
  folderId: string | null;
  sortKey: number;
};
export type PublicTreePage = { slug: string; title: string; folderId: string | null; sortKey: number };

export async function uploadBlob(file: File): Promise<{ hash: string; size: number; mimeType: string }> {
  const res = await fetch('/api/blobs', {
    method: 'POST',
    body: file,
    headers: { 'content-type': file.type },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login';
    throw new ApiError(res.status, typeof body.error === 'string' ? body.error : 'upload failed');
  }
  return body as { hash: string; size: number; mimeType: string };
}

/** Full-restore import (admin, empty instance only) [ADR-0023]. */
export async function importBundle(file: File): Promise<{
  ok: true;
  counts: { folders: number; pages: number; blocks: number; blobs: number };
}> {
  const res = await fetch('/api/admin/import', {
    method: 'POST',
    body: file,
    headers: { 'content-type': 'application/zip' },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login';
    throw new ApiError(
      res.status,
      typeof body.error === 'string' ? body.error : 'import failed',
      Array.isArray(body.details) ? (body.details as string[]) : undefined,
    );
  }
  return body as { ok: true; counts: { folders: number; pages: number; blocks: number; blobs: number } };
}

export const api = {
  signIn: (email: string, password: string) =>
    request<{ user: unknown }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<unknown>('/api/auth/sign-out', { method: 'POST', body: '{}' }),
  me: () => request<{ user: Me | null }>('/api/me'),
  listPublicNotes: () =>
    request<{ notes: Array<{ slug: string; title: string; publishedAt: number }> }>(
      '/api/public/notes',
    ),
  listNotepages: () => request<{ notepages: NotepageSummary[] }>('/api/notepages'),
  getTree: () => request<{ folders: TreeFolder[]; notepages: TreePage[] }>('/api/tree'),
  getPublicTree: () =>
    request<{ folders: TreeFolder[]; notepages: PublicTreePage[] }>('/api/public/tree'),
  createFolder: (name: string, parentId?: string) =>
    request<{ id: string }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    }),
  renameFolder: (id: string, name: string) =>
    request<{ ok: true }>(`/api/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteFolder: (id: string) => request<{ ok: true }>(`/api/folders/${id}`, { method: 'DELETE' }),
  movePage: (id: string, folderId: string | null) =>
    request<{ ok: true }>(`/api/notepages/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ folderId }),
    }),
  createNotepage: (title?: string) =>
    request<{ id: string; slug: string }>('/api/notepages', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  getNotepage: (id: string) => request<NotepageDetail>(`/api/notepages/${id}`),
  saveWorkingState: (
    id: string,
    body: { title: string; gravityEnabled: boolean; blocks: WorkingBlock[] },
  ) =>
    request<{ ok: true }>(`/api/notepages/${id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  publish: (id: string) =>
    request<{ publishedAt: number; slug: string }>(`/api/notepages/${id}/publish`, { method: 'POST' }),
  setVisibility: (id: string, visibility: 'private' | 'public') =>
    request<{ ok: true }>(`/api/notepages/${id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility }),
    }),
  deleteNotepage: (id: string) =>
    request<{ ok: true }>(`/api/notepages/${id}`, { method: 'DELETE' }),
  getPublicNote: (slug: string) =>
    request<{ slug: string; doc: PublishedDoc }>(`/api/public/notes/${slug}`),
};
