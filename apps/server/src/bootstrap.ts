/**
 * First-admin bootstrap (identity.md M2 + setup-time.md §1).
 *
 * MVP-2 implements the internet-exposed bootstrap mode only: when the
 * user table is empty, admin credentials MUST be provided via env or
 * the server refuses to start — "first public visitor becomes admin"
 * can never happen. The dev-local setup-screen path is deferred.
 *
 * User creation goes through a transient better-auth instance with
 * signup enabled; the mounted instance keeps signup permanently
 * disabled. The transient instance's HTTP handler is never mounted.
 */
import { count, eq } from 'drizzle-orm';
import { createAuth } from './auth';
import type { Db } from './db/client';
import { user } from './db/schema';

export type BootstrapEnv = {
  adminEmail?: string;
  adminPassword?: string;
  secret: string;
};

export async function ensureFirstAdmin(db: Db, env: BootstrapEnv): Promise<void> {
  const [row] = db.select({ n: count() }).from(user).all();
  if ((row?.n ?? 0) > 0) return; // users exist; nothing to bootstrap

  if (!env.adminEmail || !env.adminPassword) {
    throw new Error(
      'no users exist and SHCKB_ADMIN_EMAIL / SHCKB_ADMIN_PASSWORD are not set. ' +
        'Refusing to start (internet-exposed bootstrap mode): seed the first admin via env.',
    );
  }
  if (env.adminPassword.length < 8) {
    throw new Error('SHCKB_ADMIN_PASSWORD must be at least 8 characters.');
  }

  const bootstrapAuth = createAuth(db, { secret: env.secret, allowSignUp: true });
  await bootstrapAuth.api.signUpEmail({
    body: { email: env.adminEmail, password: env.adminPassword, name: 'Admin' },
  });
  db.update(user).set({ role: 'admin' }).where(eq(user.email, env.adminEmail)).run();
  console.log(`bootstrap: created first admin ${env.adminEmail}`);
}
