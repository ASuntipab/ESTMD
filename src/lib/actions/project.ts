'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { requireWriter } from '@/lib/dal'
import { db } from '@/lib/db'
import {
  COMPLEXITIES,
  ONCE_PER_PROJECT_UNIT,
  activities,
  matrixCells,
  projectActivityQty,
  projectItemMandays,
  projectItems,
  projectModifiers,
  projectPhases,
  projectRoles,
  projects,
  stackModifiers,
  techStacks,
} from '@/lib/db/schema'
import {
  defaultItemDetail,
  effectiveMultiplier,
  round2,
} from '@/lib/estimate'
import { listRoles } from '@/lib/queries'

/** nonce increments on every successful save, so a form can remount itself. */
export type ActionState = { error?: string; ok?: string; nonce?: number }

const touch = (projectId: number) =>
  db
    .update(projects)
    .set({ updatedAt: sql`(unixepoch())` })
    .where(eq(projects.id, projectId))

/* --------------------------------------------------------- step 1: project */

const projectSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อโครงการ'),
  code: z.string().trim().optional(),
  durationDays: z
    .union([z.literal(''), z.coerce.number().int().min(0)])
    .optional(),
  techStackId: z.union([z.literal(''), z.coerce.number().int()]).optional(),
  questionnaireId: z.union([z.literal(''), z.coerce.number().int()]).optional(),
  bufferPercent: z.coerce.number().min(0).max(100).default(0),
})

const asId = (v: unknown) => (v === '' || v == null ? null : Number(v))

export async function saveProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWriter()

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code') ?? undefined,
    durationDays: formData.get('durationDays') ?? undefined,
    techStackId: formData.get('techStackId') ?? undefined,
    questionnaireId: formData.get('questionnaireId') ?? undefined,
    bufferPercent: formData.get('bufferPercent') ?? 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const values = {
    name: parsed.data.name,
    code: parsed.data.code || null,
    durationDays: asId(parsed.data.durationDays),
    techStackId: asId(parsed.data.techStackId),
    questionnaireId: asId(parsed.data.questionnaireId),
    bufferPercent: parsed.data.bufferPercent,
  }

  // Checkbox list: only the ticked modifiers are submitted.
  const modifierIds = formData
    .getAll('modifierIds')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))

  const idRaw = formData.get('id')
  if (idRaw) {
    const id = Number(idRaw)
    const multiplierBefore = await projectMultiplier(id)

    await db
      .update(projects)
      .set({ ...values, updatedAt: sql`(unixepoch())` })
      .where(eq(projects.id, id))
    await writeProjectModifiers(id, modifierIds)

    // The multiplier feeds every developer man-day, so a change to the stack or
    // to any modifier has to flow through the whole estimate.
    if ((await projectMultiplier(id)) !== multiplierBefore) {
      await recomputeProject(id)
    }
    revalidatePath(`/projects/${id}`)
    redirect(`/projects/${id}?step=2`)
  }

  const [row] = await db
    .insert(projects)
    .values({ ...values, ownerId: user.userId, wizardStep: 2 })
    .returning({ id: projects.id })

  await writeProjectModifiers(row.id, modifierIds)
  await seedProjectRoles(row.id)
  revalidatePath('/projects')
  redirect(`/projects/${row.id}?step=2`)
}

/** Replaces the project's modifier selection with exactly `modifierIds`. */
async function writeProjectModifiers(projectId: number, modifierIds: number[]) {
  await db
    .delete(projectModifiers)
    .where(eq(projectModifiers.projectId, projectId))
  if (!modifierIds.length) return
  await db
    .insert(projectModifiers)
    .values(modifierIds.map((modifierId) => ({ projectId, modifierId })))
    .onConflictDoNothing()
}

/** Every role starts included with the master rate, mirroring the template. */
async function seedProjectRoles(projectId: number) {
  const roles = await listRoles()
  if (!roles.length) return
  await db
    .insert(projectRoles)
    .values(
      roles.map((r) => ({
        projectId,
        roleId: r.id,
        ratePerMd: r.ratePerMd,
        sortOrder: r.sortOrder,
        // The five matrix roles are the ones normally costed.
        included: ['SA', 'BA', 'DEV_SR', 'DEV', 'TESTER'].includes(r.code),
      })),
    )
    .onConflictDoNothing()
}

export async function deleteProject(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  await db.delete(projects).where(eq(projects.id, id))
  revalidatePath('/projects')
  redirect('/projects')
}

export async function setProjectStatus(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  const status = String(formData.get('status'))
  if (!['draft', 'in_review', 'approved'].includes(status)) return
  await db
    .update(projects)
    .set({
      status: status as 'draft' | 'in_review' | 'approved',
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(projects.id, id))
  revalidatePath(`/projects/${id}`)
}

export async function setWizardStep(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  const step = Number(formData.get('step'))
  if (!Number.isInteger(id) || !Number.isInteger(step)) return
  await db.update(projects).set({ wizardStep: step }).where(eq(projects.id, id))
  redirect(`/projects/${id}?step=${step}`)
}

/* ----------------------------------------------------------------- phases */

export async function addPhase(formData: FormData) {
  await requireWriter()
  const projectId = Number(formData.get('projectId'))
  const name = String(formData.get('name') ?? '').trim()
  if (!Number.isInteger(projectId) || !name) return

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${projectPhases.sortOrder}), 0)` })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))

  await db
    .insert(projectPhases)
    .values({ projectId, name, sortOrder: max + 10 })
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function renamePhase(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  const projectId = Number(formData.get('projectId'))
  const name = String(formData.get('name') ?? '').trim()
  if (!Number.isInteger(id) || !name) return
  await db
    .update(projectPhases)
    .set({ name, sortOrder: Number(formData.get('sortOrder') ?? 0) })
    .where(eq(projectPhases.id, id))
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function deletePhase(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(id)) return
  await db.delete(projectPhases).where(eq(projectPhases.id, id))
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

/* ------------------------------------------------------------------ items */

/** Technology stack multiplier times every modifier chosen for the project. */
async function projectMultiplier(projectId: number) {
  const [project] = await db
    .select({ techStackId: projects.techStackId })
    .from(projects)
    .where(eq(projects.id, projectId))

  let stackMultiplier = 1
  if (project?.techStackId) {
    const [stack] = await db
      .select({ multiplier: techStacks.multiplier })
      .from(techStacks)
      .where(eq(techStacks.id, project.techStackId))
    stackMultiplier = stack?.multiplier ?? 1
  }

  const chosen = await db
    .select({ multiplier: stackModifiers.multiplier })
    .from(projectModifiers)
    .innerJoin(stackModifiers, eq(stackModifiers.id, projectModifiers.modifierId))
    .where(eq(projectModifiers.projectId, projectId))

  return effectiveMultiplier(
    stackMultiplier,
    chosen.map((m) => m.multiplier),
  )
}

/** Standard mandays for one item, from the matrix and the project multiplier. */
async function mandaysForItem(
  projectId: number,
  activityId: number | null,
  complexity: 'L' | 'M' | 'H',
  qty: number,
) {
  const roles = await listRoles()
  if (activityId == null) return roles.map((r) => ({ roleId: r.id, manday: 0 }))

  const multiplier = await projectMultiplier(projectId)

  const cells = await db
    .select({ roleId: matrixCells.roleId, manday: matrixCells.manday })
    .from(matrixCells)
    .where(
      and(
        eq(matrixCells.activityId, activityId),
        eq(matrixCells.complexity, complexity),
      ),
    )
  const base = new Map(cells.map((c) => [c.roleId, c.manday]))

  return roles.map((role) => ({
    roleId: role.id,
    manday: round2(
      (base.get(role.id) ?? 0) * qty * (role.stackMultiplied ? multiplier : 1),
    ),
  }))
}

/** Writes standard mandays, leaving cells the estimator overrode untouched. */
async function applyStandardMandays(
  itemId: number,
  rows: { roleId: number; manday: number }[],
) {
  const existing = await db
    .select({
      roleId: projectItemMandays.roleId,
      overridden: projectItemMandays.overridden,
    })
    .from(projectItemMandays)
    .where(eq(projectItemMandays.itemId, itemId))
  const overridden = new Set(
    existing.filter((e) => e.overridden).map((e) => e.roleId),
  )

  for (const row of rows) {
    if (overridden.has(row.roleId)) continue
    await db
      .insert(projectItemMandays)
      .values({ itemId, roleId: row.roleId, manday: row.manday })
      .onConflictDoUpdate({
        target: [projectItemMandays.itemId, projectItemMandays.roleId],
        set: { manday: row.manday },
      })
  }
}

const itemSchema = z.object({
  phaseId: z.coerce.number().int(),
  detail: z.string().trim().min(1, 'กรุณากรอกรายละเอียดงาน'),
  activityId: z.union([z.literal(''), z.coerce.number().int()]).optional(),
  complexity: z.enum(COMPLEXITIES).default('M'),
  qty: z.coerce.number().min(0).default(1),
  // Not keyed in the UI yet, but still accepted and still exported, so turning
  // the two fields back on is a change to the form alone.
  dueDatePlan: z.string().trim().optional(),
  deliverables: z.string().trim().optional(),
})

export async function saveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWriter()

  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return { error: 'ไม่พบโครงการ' }

  const parsed = itemSchema.safeParse({
    phaseId: formData.get('phaseId'),
    detail: formData.get('detail'),
    activityId: formData.get('activityId') ?? undefined,
    complexity: formData.get('complexity') ?? 'M',
    qty: formData.get('qty') ?? 1,
    dueDatePlan: formData.get('dueDatePlan') ?? undefined,
    deliverables: formData.get('deliverables') ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const activityId = asId(parsed.data.activityId)

  // A row the matrix counts once per project must not be multiplied, whatever
  // the form sent.
  let qty = parsed.data.qty
  if (activityId != null) {
    const [activity] = await db
      .select({ countUnit: activities.countUnit })
      .from(activities)
      .where(eq(activities.id, activityId))
    if (activity?.countUnit === ONCE_PER_PROJECT_UNIT) qty = 1
  }

  const values = {
    projectId,
    phaseId: parsed.data.phaseId,
    activityId,
    detail: parsed.data.detail,
    complexity: parsed.data.complexity,
    qty,
    dueDatePlan: parsed.data.dueDatePlan || null,
    deliverables: parsed.data.deliverables || null,
  }

  const idRaw = formData.get('id')
  let itemId: number

  if (idRaw) {
    itemId = Number(idRaw)
    await db.update(projectItems).set(values).where(eq(projectItems.id, itemId))
  } else {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${projectItems.sortOrder}), 0)` })
      .from(projectItems)
      .where(eq(projectItems.projectId, projectId))

    const [row] = await db
      .insert(projectItems)
      .values({ ...values, sortOrder: max + 10 })
      .returning({ id: projectItems.id })
    itemId = row.id
  }

  await applyStandardMandays(
    itemId,
    await mandaysForItem(projectId, activityId, parsed.data.complexity, qty),
  )
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
  return {
    ok: idRaw ? 'บันทึกรายการแล้ว' : 'เพิ่มรายการแล้ว',
    nonce: (_prev.nonce ?? 0) + 1,
  }
}

export async function deleteItem(formData: FormData) {
  await requireWriter()
  const id = Number(formData.get('id'))
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(id)) return
  await db.delete(projectItems).where(eq(projectItems.id, id))
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

/** Manual edit of a single manday cell; marks it as an override. */
export async function overrideManday(formData: FormData) {
  await requireWriter()
  const itemId = Number(formData.get('itemId'))
  const roleId = Number(formData.get('roleId'))
  const projectId = Number(formData.get('projectId'))
  const manday = Number(formData.get('manday'))
  if (!Number.isInteger(itemId) || !Number.isInteger(roleId)) return
  if (!Number.isFinite(manday) || manday < 0) return

  await db
    .insert(projectItemMandays)
    .values({ itemId, roleId, manday: round2(manday), overridden: true })
    .onConflictDoUpdate({
      target: [projectItemMandays.itemId, projectItemMandays.roleId],
      set: { manday: round2(manday), overridden: true },
    })
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

/** Drops every override and rebuilds the estimate from the standard matrix. */
export async function recomputeProject(projectId: number) {
  const items = await db
    .select({
      id: projectItems.id,
      activityId: projectItems.activityId,
      complexity: projectItems.complexity,
      qty: projectItems.qty,
    })
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId))

  for (const item of items) {
    const rows = await mandaysForItem(
      projectId,
      item.activityId,
      item.complexity,
      item.qty,
    )
    for (const row of rows) {
      await db
        .insert(projectItemMandays)
        .values({ itemId: item.id, roleId: row.roleId, manday: row.manday })
        .onConflictDoUpdate({
          target: [projectItemMandays.itemId, projectItemMandays.roleId],
          set: { manday: row.manday, overridden: false },
        })
    }
  }
}

export async function resetToStandard(formData: FormData) {
  await requireWriter()
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return
  await recomputeProject(projectId)
  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
}

/* ------------------------------------------------------- step 4: team rates */

export async function saveProjectRoles(formData: FormData) {
  await requireWriter()
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return

  const roles = await listRoles()
  for (const role of roles) {
    const rate = Number(formData.get(`rate_${role.id}`))
    await db
      .insert(projectRoles)
      .values({
        projectId,
        roleId: role.id,
        included: formData.get(`included_${role.id}`) === 'on',
        resourceLabel:
          String(formData.get(`label_${role.id}`) ?? '').trim() || null,
        personName: String(formData.get(`person_${role.id}`) ?? '').trim() || null,
        ratePerMd: Number.isFinite(rate) && rate >= 0 ? rate : role.ratePerMd,
        sortOrder: role.sortOrder,
      })
      .onConflictDoUpdate({
        target: [projectRoles.projectId, projectRoles.roleId],
        set: {
          included: formData.get(`included_${role.id}`) === 'on',
          resourceLabel:
            String(formData.get(`label_${role.id}`) ?? '').trim() || null,
          personName:
            String(formData.get(`person_${role.id}`) ?? '').trim() || null,
          ratePerMd: Number.isFinite(rate) && rate >= 0 ? rate : role.ratePerMd,
        },
      })
  }
  await touch(projectId)
  redirect(`/projects/${projectId}?step=5`)
}

/* ------------------------------ applying questionnaire answers to the items */

/**
 * Creates one line item per answered question that is linked to an activity,
 * using the complexity the answers derived. This is the bridge from the
 * questionnaire into the wizard for a requirement that was not clear.
 */
export async function generateItemsFromAnswers(formData: FormData) {
  await requireWriter()
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return

  const answered = await db
    .select({
      activityId: projectActivityQty.activityId,
      complexity: projectActivityQty.complexity,
      qty: projectActivityQty.qty,
      detail: projectActivityQty.detail,
      code: activities.code,
      name: activities.name,
      groupName: activities.groupName,
      countUnit: activities.countUnit,
      sortOrder: activities.sortOrder,
    })
    .from(projectActivityQty)
    .innerJoin(activities, eq(activities.id, projectActivityQty.activityId))
    .where(eq(projectActivityQty.projectId, projectId))
    .orderBy(asc(activities.sortOrder))

  const usable = answered.filter((a) => a.qty > 0)
  if (!usable.length) return

  // One phase per activity group, so the generated plan reads like the export
  // template rather than landing in a single bucket.
  const phaseIdByName = new Map(
    (
      await db
        .select({ id: projectPhases.id, name: projectPhases.name })
        .from(projectPhases)
        .where(eq(projectPhases.projectId, projectId))
    ).map((p) => [p.name, p.id]),
  )

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${projectPhases.sortOrder}), 0)` })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
  let phaseOrder = max

  async function phaseFor(name: string) {
    const existing = phaseIdByName.get(name)
    if (existing) return existing
    phaseOrder += 10
    const [row] = await db
      .insert(projectPhases)
      .values({ projectId, name, sortOrder: phaseOrder })
      .returning({ id: projectPhases.id })
    phaseIdByName.set(name, row.id)
    return row.id
  }

  // A line the survey generated before is updated in place rather than
  // duplicated, so an edited wording or quantity reaches the summary and the
  // export without the estimator having to delete anything.
  const existingItems = await db
    .select({
      id: projectItems.id,
      activityId: projectItems.activityId,
      complexity: projectItems.complexity,
      qty: projectItems.qty,
    })
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId))
  const existingByKey = new Map<string, typeof existingItems>()
  for (const i of existingItems) {
    const key = `${i.activityId}_${i.complexity}`
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), i])
  }

  let sortOrder = 0
  for (const answer of usable) {
    const key = `${answer.activityId}_${answer.complexity}`

    // A row counted once per project must not be multiplied.
    const qty = answer.countUnit === ONCE_PER_PROJECT_UNIT ? 1 : answer.qty
    const detail =
      answer.detail?.trim() ||
      defaultItemDetail(answer.name, answer.countUnit, qty)

    const existing = existingByKey.get(key) ?? []
    // Several keyed lines can share one answer (one per function). When they
    // already add up to it, the answer describes them and nothing changes;
    // overwriting one of them with the total would count the rest twice.
    if (existing.length > 1) {
      const sum = existing.reduce((s, i) => s + i.qty, 0)
      if (sum === qty) continue
    }
    const existingId = existing.length === 1 ? existing[0].id : undefined
    let itemId: number

    if (existing.length > 1) {
      // The answer changed: put the difference on the last line, keeping the
      // others as they are.
      const last = existing[existing.length - 1]
      const lastQty = qty - (existing.reduce((s, i) => s + i.qty, 0) - last.qty)
      if (lastQty <= 0) continue
      await db
        .update(projectItems)
        .set({ qty: lastQty })
        .where(eq(projectItems.id, last.id))
      await applyStandardMandays(
        last.id,
        await mandaysForItem(projectId, answer.activityId, answer.complexity, lastQty),
      )
      continue
    } else if (existingId) {
      await db
        .update(projectItems)
        .set({ detail, qty })
        .where(eq(projectItems.id, existingId))
      itemId = existingId
    } else {
      const phaseId = await phaseFor(answer.groupName ?? answer.name)
      const [row] = await db
        .insert(projectItems)
        .values({
          projectId,
          phaseId,
          activityId: answer.activityId,
          detail,
          complexity: answer.complexity,
          qty,
          sortOrder: (sortOrder += 10),
        })
        .returning({ id: projectItems.id })
      itemId = row.id
    }

    await applyStandardMandays(
      itemId,
      await mandaysForItem(projectId, answer.activityId, answer.complexity, qty),
    )
  }

  await touch(projectId)
  revalidatePath(`/projects/${projectId}`)
  redirect(`/projects/${projectId}?step=3`)
}
