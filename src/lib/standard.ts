import matrix from './db/standard-matrix.json'

/**
 * Facts that come from the standard matrix file rather than the database:
 * defaults a new project starts from, and the file's own identity.
 */
export const STANDARD = {
  source: matrix.source,
  version: matrix.version,
  defaultBufferPercent: matrix.defaultBufferPercent,
  complexityLegend: matrix.complexityLegend,
} as const
