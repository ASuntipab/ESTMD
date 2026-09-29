'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import {
  activities,
  matrixCells,
  projectModifiers,
  projects,
  roles,
  stackModifiers,
  techStacks,
} from '@/lib/db/schema'

export type ActionState = { error?: string; ok?: string }

const activitySchema = z.object({
  code: z.string().trim().min(1, 'กรุณากรอกรหัส'),
  groupName: z.string().trim().optional(),
  name: z.string().trim().min(1, 'กรุณากรอกชื่องาน'),
  unit: z.string().trim().min(1).default('MD'),
  countUnit: z.string().trim().min(1, 'กรุณาระบุหน่วยนับ'),
  notes: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
})

/** Cell inputs arrive as `cell_<roleId>_<complexity>`. */
function readCells(formData: FormData) {
  const cells: { roleId: number; complexity: 'L' | 'M' | 'H'; manday: number }[] =
    []
  for (const [key, value] of formData.entries()) {
    const match = /^cell_(\d+)_(L|M|H)$/.exec(key)
    if (!match) continue
    const manday = Number(value)
    cells.push({
      roleId: Number(match[1]),
      complexity: match[2] as 'L' | 'M' | 'H',
      manday: Number.isFinite(manday) && manday >= 0 ? manday : 0,
    })
  }
  return cells
}

async function writeCells(
  activityId: number,
  cells: ReturnType<typeof readCells>,
) {
  for (const cell of cells) {
    await db
      .insert(matrixCells)
      .values({ activityId, ...cell })
      .onConflictDoUpdate({
        target: [
          matrixCells.activityId,
          matrixCells.roleId,
          matrixCells.complexity,
        ],
        set: { manday: cell.manday },
      })
  }
}

export async function saveActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const parsed = activitySchema.safeParse({
    code: formData.get('code'),
    groupName: formData.get('groupName') ?? undefined,
    name: formData.get('name'),
    unit: formData.get('unit') ?? 'MD',
    countUnit: formData.get('countUnit') ?? 'ต่อรายการ',
    notes: formData.get('notes') ?? undefined,
    sortOrder: formData.get('sortOrder') ?? 0,
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const idRaw = formData.get('id')
  const id = idRaw ? Number(idRaw) : null
  const values = {
    ...parsed.data,
    groupName: parsed.data.groupName || null,
    notes: parsed.data.notes || null,
  }

  let activityId = id
  try {
    if (id) {
      await db.update(activities).set(values).where(eq(activities.id, id))
    } else {
      const [row] = await db
        .insert(activities)
        .values(values)
        .returning({ id: activities.id })
      activityId = row.id
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      error: message.includes('UNIQUE')
        ? `รหัส "${values.code}" ถูกใช้แล้ว`
        : message,
    }
  }

  await writeCells(activityId!, readCells(formData))
  revalidatePath('/matrix')
  redirect(`/matrix/${activityId}?saved=1`)
}

export async function deleteActivity(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  await db.delete(activities).where(eq(activities.id, id))
  revalidatePath('/matrix')
  redirect('/matrix')
}

/* --------------------------------------------------------------- tech stacks */

const techStackSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อ stack'),
  multiplier: z.coerce.number().min(0.1, 'ตัวคูณต้องมากกว่า 0').max(10),
  note: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().default(0),
})

export async function saveTechStack(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const parsed = techStackSchema.safeParse({
    name: formData.get('name'),
    multiplier: formData.get('multiplier'),
    note: formData.get('note') ?? undefined,
    sortOrder: formData.get('sortOrder') ?? 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const idRaw = formData.get('id')
  const values = { ...parsed.data, note: parsed.data.note || null }

  try {
    if (idRaw) {
      await db
        .update(techStacks)
        .set(values)
        .where(eq(techStacks.id, Number(idRaw)))
    } else {
      await db.insert(techStacks).values(values)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      error: message.includes('UNIQUE') ? 'ชื่อ stack นี้มีอยู่แล้ว' : message,
    }
  }

  revalidatePath('/matrix/tech-stacks')
  return { ok: 'บันทึกแล้ว' }
}

/**
 * Removes a stack, unless a project points at it. Deleting one that is in use
 * would blank that project's stack while its man-days keep the old multiplier
 * baked in, so the estimate could no longer be explained. Those are deactivated
 * instead: they drop off the pick list but stay resolvable.
 */
export async function deleteTechStack(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return { error: 'ไม่พบรายการ' }

  const [used] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.techStackId, id))
    .limit(1)

  if (used) {
    await db.update(techStacks).set({ active: false }).where(eq(techStacks.id, id))
    revalidatePath('/matrix/tech-stacks')
    return { ok: 'มีโครงการใช้อยู่ จึงปิดใช้งานแทนการลบ' }
  }

  await db.delete(techStacks).where(eq(techStacks.id, id))
  revalidatePath('/matrix/tech-stacks')
  return { ok: 'ลบแล้ว' }
}

/* ---------------------------------------------------------------- modifiers */

const modifierSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อตัวปรับ'),
  multiplier: z.coerce.number().min(0.1, 'ตัวคูณต้องมากกว่า 0').max(10),
  note: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().default(0),
})

export async function saveStackModifier(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const parsed = modifierSchema.safeParse({
    name: formData.get('name'),
    multiplier: formData.get('multiplier'),
    note: formData.get('note') ?? undefined,
    sortOrder: formData.get('sortOrder') ?? 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const values = { ...parsed.data, note: parsed.data.note || null }
  const idRaw = formData.get('id')

  try {
    if (idRaw) {
      await db
        .update(stackModifiers)
        .set(values)
        .where(eq(stackModifiers.id, Number(idRaw)))
    } else {
      await db.insert(stackModifiers).values(values)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      error: message.includes('UNIQUE') ? 'ชื่อตัวปรับนี้มีอยู่แล้ว' : message,
    }
  }

  revalidatePath('/matrix/tech-stacks')
  return { ok: 'บันทึกแล้ว' }
}

/** Same rule as deleteTechStack: deactivate when a project still uses it. */
export async function deleteStackModifier(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return { error: 'ไม่พบรายการ' }

  const [used] = await db
    .select({ id: projectModifiers.id })
    .from(projectModifiers)
    .where(eq(projectModifiers.modifierId, id))
    .limit(1)

  if (used) {
    await db
      .update(stackModifiers)
      .set({ active: false })
      .where(eq(stackModifiers.id, id))
    revalidatePath('/matrix/tech-stacks')
    return { ok: 'มีโครงการใช้อยู่ จึงปิดใช้งานแทนการลบ' }
  }

  await db.delete(stackModifiers).where(eq(stackModifiers.id, id))
  revalidatePath('/matrix/tech-stacks')
  return { ok: 'ลบแล้ว' }
}

/** Puts a deactivated stack or modifier back on the pick list. */
export async function setMultiplierActive(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const active = formData.get('active') === '1'
  const kind = String(formData.get('kind'))
  if (!Number.isInteger(id)) return

  if (kind === 'modifier') {
    await db
      .update(stackModifiers)
      .set({ active })
      .where(eq(stackModifiers.id, id))
  } else {
    await db.update(techStacks).set({ active }).where(eq(techStacks.id, id))
  }
  revalidatePath('/matrix/tech-stacks')
}

/* --------------------------------------------------------------------- roles */

export async function saveRoleRate(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const rate = Number(formData.get('ratePerMd'))
  if (!Number.isInteger(id) || !Number.isFinite(rate) || rate < 0) return

  const scopeRaw = String(formData.get('scope') ?? 'item')
  const ratioRaw = String(formData.get('ratioOfDev') ?? '').trim()
  const ratio = ratioRaw === '' ? null : Number(ratioRaw)

  await db
    .update(roles)
    .set({
      ratePerMd: rate,
      stackMultiplied: formData.get('stackMultiplied') === 'on',
      scope: scopeRaw === 'phase' ? 'phase' : 'item',
      ratioOfDev:
        ratio != null && Number.isFinite(ratio) && ratio >= 0 ? ratio : null,
    })
    .where(eq(roles.id, id))
  revalidatePath('/matrix/roles')
  revalidatePath('/projects')
}
