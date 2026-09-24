#!/bin/sh
# Vercel's buildCommand has a 256-char limit, so this guard lives here instead
# of inline in vercel.json.
#
# prisma.config.ts resolves the migrate CLI's datasource to DIRECT_URL,
# falling back to DATABASE_URL (the pgbouncer transaction pooler, port 6543)
# when DIRECT_URL isn't set for this environment. Pgbouncer's transaction
# mode doesn't support the advisory lock `prisma migrate deploy` takes before
# applying migrations, so instead of erroring it just hangs until Vercel's
# own build timeout kills it. Fail fast with a clear message instead.
set -e

if [ -z "$DIRECT_URL" ]; then
  echo "DIRECT_URL is not set for this Vercel environment — refusing to run" >&2
  echo "prisma migrate deploy against the pooled DATABASE_URL (it would hang" >&2
  echo "on the advisory lock instead of failing). Set DIRECT_URL for this" >&2
  echo "environment to the session-pooler or direct connection string" >&2
  echo "(port 5432), not the transaction pooler (port 6543)." >&2
  exit 1
fi

npx prisma migrate deploy
next build
