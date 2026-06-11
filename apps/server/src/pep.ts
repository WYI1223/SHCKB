/**
 * PEP seam (mvp-scope D3). The middleware chain is where authn/authz
 * will centrally live per authentication/pep.md; the MVP carries the
 * seam with a fixed local-author principal and zero identity machinery.
 *
 * ctx.user contract held even in stub form: immutable Value Object,
 * set once at request entry, `null` would be the anonymous principal.
 */
import type { MiddlewareHandler } from 'hono';

export type Principal = {
  readonly id: string;
  readonly role: 'admin' | 'author';
};

const LOCAL_AUTHOR: Principal = Object.freeze({
  id: 'local-author',
  role: 'author' as const,
});

declare module 'hono' {
  interface ContextVariableMap {
    user: Principal | null;
  }
}

export const pep: MiddlewareHandler = async (c, next) => {
  // Public read path carries the anonymous principal (ctx.user === null).
  if (c.req.path.startsWith('/api/public/')) {
    c.set('user', null);
  } else {
    c.set('user', LOCAL_AUTHOR);
  }
  await next();
};
