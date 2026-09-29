/**
 * Creates or upgrades the SQLite schema by applying the generated migrations in
 * `drizzle/`. Plain JavaScript on purpose: it has to run on the server, which
 * has no TypeScript toolchain.
 *
 *   node scripts/migrate.cjs
 */
require('./load-env.cjs')

const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3')
const { migrate } = require('drizzle-orm/better-sqlite3/migrator')

const root = path.resolve(__dirname, '..')
const file = path.resolve(root, process.env.DATABASE_PATH || './data/estmanday.db')
const migrationsFolder = path.join(root, 'drizzle')

if (!fs.existsSync(migrationsFolder)) {
  throw new Error(`migrations folder not found: ${migrationsFolder}`)
}

fs.mkdirSync(path.dirname(file), { recursive: true })

const sqlite = new Database(file)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

migrate(drizzle(sqlite), { migrationsFolder })
sqlite.close()

console.log(`schema up to date: ${file}`)
