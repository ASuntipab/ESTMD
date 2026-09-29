// Deletes the local SQLite file so `npm run db:reset` starts from scratch.
require('./load-env.cjs')

const fs = require('node:fs')
const path = require('node:path')

const file = path.resolve(
  __dirname,
  '..',
  process.env.DATABASE_PATH || './data/estmanday.db',
)
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(file + suffix, { force: true })
}
console.log('removed ' + path.basename(file))
