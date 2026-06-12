import { describe, expect, test } from 'bun:test';
import { createApp } from '../src/app';
import { ensureFirstAdmin } from '../src/bootstrap';
import { createAuth } from '../src/auth';
import { createDb } from '../src/db/client';
import { ADMIN_EMAIL, ADMIN_PASSWORD, TEST_SECRET, createTestContext, json, signIn } from './helpers';

describe('bootstrap (internet-exposed mode)', () => {
  test('refuses to start with empty user table and no admin env', async () => {
    const { db } = createDb(':memory:');
    expect(ensureFirstAdmin(db, { secret: TEST_SECRET })).rejects.toThrow(/Refusing to start/);
  });

  test('rejects short admin password', async () => {
    const { db } = createDb(':memory:');
    expect(
      ensureFirstAdmin(db, { adminEmail: 'a@b.c', adminPassword: 'short', secret: TEST_SECRET }),
    ).rejects.toThrow(/at least 8/);
  });

  test('is idempotent: existing users skip bootstrap even without env', async () => {
    const { db } = createDb(':memory:');
    await ensureFirstAdmin(db, {
      adminEmail: ADMIN_EMAIL,
      adminPassword: ADMIN_PASSWORD,
      secret: TEST_SECRET,
    });
    // second start without env must not throw
    await ensureFirstAdmin(db, { secret: TEST_SECRET });
  });
});

describe('auth wire surface', () => {
  test('sign-in grants session; wrong password rejected', async () => {
    const t = await createTestContext();
    const bad = await t.app.request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong-password' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(bad.status).toBe(401);
  });

  test('public signup is disabled on the mounted instance', async () => {
    const t = await createTestContext();
    const res = await t.app.request('http://localhost/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'intruder@evil.test', password: 'password123', name: 'X' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('anonymous requests: protected 401, public surface open', async () => {
    const t = await createTestContext();
    expect((await t.app.request('/api/notepages')).status).toBe(401);
    expect((await t.app.request('/api/notepages', { method: 'POST' })).status).toBe(401);
    expect((await t.app.request('/api/health')).status).toBe(200);
    expect((await t.app.request('/api/public/notes/nope')).status).toBe(404); // open, clean 404
    // principal introspection is anonymous-safe
    const me = await json(await t.app.request('/api/me'));
    expect(me.user).toBeNull();
  });

  test('public directory lists only public+published, with published titles', async () => {
    const t = await createTestContext();
    const mk = async (title: string) =>
      json(await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) }));
    const pub = await mk('Visible Note');
    const priv = await mk('Private Note');
    const unpub = await mk('Public But Unpublished');
    await t.authed(`/api/notepages/${pub.id}/publish`, { method: 'POST' });
    await t.authed(`/api/notepages/${pub.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'public' }),
    });
    await t.authed(`/api/notepages/${priv.id}/publish`, { method: 'POST' });
    await t.authed(`/api/notepages/${unpub.id}/visibility`, {
      method: 'POST',
      body: JSON.stringify({ visibility: 'public' }),
    });
    // rename pub's working state — directory must keep showing the published title
    await t.authed(`/api/notepages/${pub.id}/working-state`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Renamed In Working', gravityEnabled: true, blocks: [] }),
    });

    const dir = await json(await t.app.request('/api/public/notes')); // anonymous
    expect(dir.notes).toHaveLength(1);
    expect(dir.notes[0]).toMatchObject({ slug: 'visible-note', title: 'Visible Note' });
  });

  test('sign-out invalidates the session', async () => {
    const t = await createTestContext();
    expect((await t.authed('/api/notepages')).status).toBe(200);
    const out = await t.authed('/api/auth/sign-out', { method: 'POST', body: '{}' });
    expect(out.status).toBe(200);
    expect((await t.authed('/api/notepages')).status).toBe(401);
  });

  test('ctx.user principal is frozen and carries no secrets', async () => {
    const t = await createTestContext();
    const me = await json(await t.authed('/api/me'));
    expect(Object.keys(me.user).sort()).toEqual(['email', 'id', 'name', 'role']);
  });
});

describe('role gate — requireAdmin (T2, mvp7 review)', () => {
  test('author role: settings writes and the whole admin surface are 403', async () => {
    const t = await createTestContext();
    // create an author the same way bootstrap creates the admin: a
    // transient signup-enabled auth instance (never mounted)
    const transient = createAuth(t.db, { secret: TEST_SECRET, allowSignUp: true });
    await transient.api.signUpEmail({
      body: { email: 'author@local.test', password: 'author-password-1', name: 'Author' },
    });
    const cookie = await signIn(t.app, 'author@local.test', 'author-password-1');
    const asAuthor = (path: string, init?: RequestInit) =>
      t.app.request(`http://localhost${path}`, {
        ...init,
        headers: { cookie, 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });

    const me = await json(await asAuthor('/api/me'));
    expect(me.user.role).toBe('author');

    // authoring stays open; settings read stays open
    expect((await asAuthor('/api/notepages')).status).toBe(200);
    expect((await asAuthor('/api/settings')).status).toBe(200);

    // every role-gated write answers 403 for the author principal
    const gated: Array<[string, RequestInit]> = [
      ['/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme: 'ink' }) }],
      [
        '/api/settings/theme-customization',
        { method: 'PUT', body: JSON.stringify({ themeId: 'workbench', customization: { paletteId: 'warm' } }) },
      ],
      ['/api/admin/export', {}],
      ['/api/admin/import', { method: 'POST' }],
      ['/api/admin/blobs/gc', { method: 'POST' }],
    ];
    for (const [path, init] of gated) {
      const res = await asAuthor(path, init);
      expect(`${path} → ${res.status}`).toBe(`${path} → 403`);
    }

    // the admin still passes the same gates (the gate discriminates, not blocks)
    expect((await t.authed('/api/admin/export')).status).toBe(200);
  });
});
