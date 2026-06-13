import type { APIRequestContext, Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@local.dev';
export const ADMIN_PASSWORD = 'dev-admin-password';

/** Stable DOM hooks (grounded in GridCanvas.tsx / MarkdownEditView.tsx / frames.tsx). */
export const sel = {
  block: (id: string) => `[data-block-id="${id}"]`,
  activeMarkdownTextarea: 'textarea[aria-label="Markdown source"]',
  skbBlock: (id: string) => `[data-block-id="${id}"] .skb-block`,
};

/** Log in through the real auth endpoint, then hand the session
 * cookie to the browser context so /edit/:id loads authenticated.
 * page.request shares the context cookie jar with page navigations. */
export async function loginViaApi(page: Page) {
  const res = await page.request.post('http://localhost:3210/api/auth/sign-in/email', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()} ${await res.text()}`);
}

export type E2EBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  shell?: string | null;
  autofit?: 'off' | 'grow' | 'grow+shrink' | null;
  minRowSpan?: number | null;
  content: unknown;
};

/** Build a page the honest way (mirrors seed-examples createPage):
 * create → PUT working-state → theme → publish → public. Returns the
 * page id (for /edit/:id) and slug (for /notes/:slug). gravityEnabled
 * defaults ON (the autofit commit-compaction rule). */
export async function createMarkdownPage(
  request: APIRequestContext,
  opts: { title: string; themeId: string; blocks: E2EBlock[]; gravityEnabled?: boolean },
): Promise<{ id: string; slug: string }> {
  const base = 'http://localhost:3210';
  const j = async (method: 'POST' | 'PUT', path: string, body?: unknown) => {
    const r = await request.fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      data: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok()) throw new Error(`${method} ${path} -> ${r.status()}: ${await r.text()}`);
    return r.json();
  };
  const { id } = (await j('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await j('PUT', `/api/notepages/${id}/working-state`, {
    title: opts.title,
    gravityEnabled: opts.gravityEnabled ?? true,
    blocks: opts.blocks,
  });
  await j('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await j('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await j('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  return { id, slug: pub.slug };
}

export const md = (markdown: string) => ({ markdown });
