/**
 * CLI-only config: lets `@better-auth/cli generate` emit the drizzle
 * schema for better-auth's tables. The CLI runs under Node and only
 * inspects options to compute the schema, so the db handle is a stub
 * (bun:sqlite cannot be imported here). Never imported by runtime code.
 */
import { createAuth } from './auth';

export const auth = createAuth({} as never, {
  secret: 'schema-generation-only',
});
