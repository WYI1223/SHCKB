/**
 * PEP middleware (authentication/pep.md M2 slice): every /api request
 * passes through here; handlers never re-verify identity.
 *
 * ctx.user contract: immutable Value Object set once at request entry;
 * minimal identity fields only (no tokens/session secrets);
 * `ctx.user === null` is the legitimate anonymous principal state.
 *
 * MVP-2 authorization model: a single-user instance — any
 * authenticated user may author; anonymous may only reach the public
 * read surface. Resource ownership (requireOwner) enters with
 * multi-user support, not before.
 */
import type { MiddlewareHandler } from 'hono';
import type { Auth } from './auth';

export type Principal = {
  readonly id: string;
  readonly role: 'admin' | 'author';
  readonly name: string;
  readonly email: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: Principal | null;
  }
}

/** Paths under /api that the anonymous principal may reach.
 * /api/me is principal introspection: anonymous gets {user: null}. */
const ANONYMOUS_PREFIXES = ['/api/public/', '/api/auth/', '/api/health', '/api/me'];

export function createPep(auth: Auth): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session) {
      const u = session.user as { id: string; role?: string | null; name: string; email: string };
      c.set(
        'user',
        Object.freeze({
          id: u.id,
          role: u.role === 'admin' ? 'admin' : 'author',
          name: u.name,
          email: u.email,
        }),
      );
    } else {
      c.set('user', null);
    }

    if (c.get('user') === null && !ANONYMOUS_PREFIXES.some((p) => c.req.path.startsWith(p))) {
      return c.json({ error: 'authentication required' }, 401);
    }
    await next();
  };
}
