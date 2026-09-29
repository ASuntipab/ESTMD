import 'server-only'

import { connect, type Db } from './connect'

import * as schema from './schema'

// `next dev` re-evaluates modules on every edit; keep one handle per process so
// we do not leak file descriptors.
const globalForDb = globalThis as unknown as { __estMandayDb?: Db }

export const db = (globalForDb.__estMandayDb ??= connect())
export { schema }
