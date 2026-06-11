/**
 * Auth subsystem wiring (identity.md M2 slice; ADR-0021).
 *
 * better-auth is the L3 AuthAdapter implementation behind SHCKB's
 * stable seams: routes mount under /api/auth/*, the PEP middleware
 * maps better-auth sessions to the immutable ctx.user Principal.
 * Public signup is permanently disabled on the mounted instance —
 * first-admin creation goes through a transient bootstrap instance
 * (see bootstrap.ts) that is never exposed.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from './db/client';

export type AuthOptions = {
  secret: string;
  baseURL?: string;
  /** Only the bootstrap instance may enable signup; never the mounted one. */
  allowSignUp?: boolean;
};

export function createAuth(db: Db, opts: AuthOptions) {
  return betterAuth({
    secret: opts.secret,
    baseURL: opts.baseURL,
    basePath: '/api/auth',
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !(opts.allowSignUp ?? false),
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'author',
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
