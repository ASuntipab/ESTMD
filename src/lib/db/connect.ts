import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

/**
 * Opens the SQLite file. Kept free of `server-only` so the seed and maintenance
 * scripts can reuse it outside the Next.js bundler.
 */
export function connect() {
  // The path comes from the environment at runtime, so the bundler cannot and
  // should not try to trace it.
  const file = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATABASE_PATH ?? './data/estmanday.db',
  )
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export type Db = ReturnType<typeof connect>
