import type { Complexity } from './db/schema'

export type RoleLike = {
  id: number
  code: string
  name: string
  stackMultiplied: boolean
  ratePerMd: number
  seniority: 'senior' | 'junior'
  scope: 'item' | 'phase'
  ratioOfDev: number | null
  sortOrder: number
}

export type MatrixLookup = Map<string, number>

export const cellKey = (
  activityId: number,
  roleId: number,
  complexity: Complexity,
) => `${activityId}:${roleId}:${complexity}`

export function buildMatrixLookup(
  cells: { activityId: number; roleId: number; complexity: Complexity; manday: number }[],
): MatrixLookup {
  const map: MatrixLookup = new Map()
  for (const c of cells) {
    map.set(cellKey(c.activityId, c.roleId, c.complexity), c.manday)
  }
  return map
}

/** Rounds to 2 decimals; manday values in the master file use at most 0.5 steps. */
export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Standard manday for one line item and role:
 *   matrix[activity][role][complexity] x qty x (stack multiplier, dev roles only)
 */
export function standardManday({
  matrix,
  activityId,
  role,
  complexity,
  qty,
  stackMultiplier,
}: {
  matrix: MatrixLookup
  activityId: number | null
  role: RoleLike
  complexity: Complexity
  qty: number
  stackMultiplier: number
}) {
  if (activityId == null) return 0
  const base = matrix.get(cellKey(activityId, role.id, complexity)) ?? 0
  const multiplier = role.stackMultiplied ? stackMultiplier : 1
  return round2(base * (qty || 0) * multiplier)
}

/**
 * The multiplier applied to the stack-sensitive roles: the chosen technology
 * stack, times every modifier that applies. Modifiers compound, so
 * "Responsive Web" (x1.15) on an unfamiliar stack (x1.4) gives x1.61.
 */
export function effectiveMultiplier(
  stackMultiplier: number | null | undefined,
  modifierMultipliers: number[],
) {
  const product = modifierMultipliers.reduce(
    (acc, m) => acc * (m || 1),
    stackMultiplier || 1,
  )
  // Multiplying decimals leaves binary noise (1 * 1.15 * 1.4 = 1.6099999...),
  // which would otherwise show up on screen and in the export.
  return Math.round(product * 10000) / 10000
}

export type SummaryRow = {
  role: RoleLike
  manday: number
  ratePerMd: number
  cost: number
}

export function summarise(
  rows: { roleId: number; manday: number }[],
  roles: RoleLike[],
  rateOverrides: Map<number, number | null | undefined>,
): { perRole: SummaryRow[]; totalManday: number; totalCost: number } {
  const byRole = new Map<number, number>()
  for (const r of rows) {
    byRole.set(r.roleId, (byRole.get(r.roleId) ?? 0) + r.manday)
  }

  const perRole = roles
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((role) => {
      const manday = round2(byRole.get(role.id) ?? 0)
      const ratePerMd = rateOverrides.get(role.id) ?? role.ratePerMd
      return { role, manday, ratePerMd, cost: round2(manday * ratePerMd) }
    })

  return {
    perRole,
    totalManday: round2(perRole.reduce((s, r) => s + r.manday, 0)),
    totalCost: round2(perRole.reduce((s, r) => s + r.cost, 0)),
  }
}

/** The wording a generated line item gets when nobody overrode it. */
export function defaultItemDetail(
  activityName: string,
  countUnit: string,
  qty: number,
) {
  return `${activityName} (${qty} ${countUnit.replace(/^ต่อ/, '').trim()})`
}
