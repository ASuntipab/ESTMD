'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireAdmin, requireWriter } from '@/lib/dal'
import { db } from '@/lib/db'
import {
  COMPLEXITIES,
  projectActivityQty,
  questionnaireActivities,
  questionnaires,
} from '@/lib/db/schema'

/** nonce changes on every successful save so a dialog can close itself. */
export type ActionState = { error?: string; ok?: string; nonce?: number }

const headerSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อชุดคำถาม'),
  description: z.string().trim().optional(),
  active: z.coerce.boolean().default(true),
})

export async function saveQuestionnaire(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const parsed = headerSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const values = {
    ...parsed.data,
    description: parsed.data.description || null,
  }
  const idRaw = formData.get('id')

  if (idRaw) {
    await db
      .update(questionnaires)
      .set(values)
      .where(eq(questionnaires.id, Number(idRaw)))
    revalidatePath(`/questionnaires/${idRaw}`)
    return { ok: 'บันทึกแล้ว' }
  }

  const [row] = await db
    .insert(questionnaires)
    .values(values)
    .returning({ id: questionnaires.id })
  revalidatePath('/questionnaires')
  redirect(`/questionnaires/${row.id}`)
}

export async function deleteQuestionnaire(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  await db.delete(questionnaires).where(eq(questionnaires.id, id))
  revalidatePath('/questionnaires')
  redirect('/questionnaires')
}

/* ------------------------------------------------------------- survey topics */

/**
 * Replaces the survey's topic list with exactly the activities ticked in the
 * editor, keeping the matrix order.
 */
export async function saveQuestionnaireTopics(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const questionnaireId = Number(formData.get('questionnaireId'))
  if (!Number.isInteger(questionnaireId)) return { error: 'ไม่พบชุดคำถาม' }

  const activityIds = formData
    .getAll('activityIds')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))

  await db
    .delete(questionnaireActivities)
    .where(eq(questionnaireActivities.questionnaireId, questionnaireId))

  if (activityIds.length) {
    await db
      .insert(questionnaireActivities)
      .values(
        activityIds.map((activityId, index) => ({
          questionnaireId,
          activityId,
          sortOrder: (index + 1) * 10,
        })),
      )
      .onConflictDoNothing()
  }

  revalidatePath(`/questionnaires/${questionnaireId}`)
  return { ok: `บันทึก ${activityIds.length} หัวข้อแล้ว` }
}

/** Free-text guidance shown under one topic while answering. */
export async function saveTopicHelpText(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const questionnaireId = formData.get('questionnaireId')
  if (!Number.isInteger(id)) return
  await db
    .update(questionnaireActivities)
    .set({ helpText: String(formData.get('helpText') ?? '').trim() || null })
    .where(eq(questionnaireActivities.id, id))
  revalidatePath(`/questionnaires/${questionnaireId}`)
}

/* ------------------------------------------------ answering it for a project */

/**
 * Stores the quantities keyed on the survey: one number per topic per
 * complexity level. Inputs arrive as `qty_<activityId>_<L|M|H>`; a zero or
 * blank means the project does not need that combination, so the row is
 * removed rather than stored as 0.
 */
export async function saveActivityQuantities(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWriter()

  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return { error: 'ไม่พบโครงการ' }

  let filled = 0
  let totalQty = 0

  for (const [key, raw] of formData.entries()) {
    const match = /^qty_(\d+)_(L|M|H)$/.exec(key)
    if (!match) continue

    const activityId = Number(match[1])
    const complexity = match[2] as (typeof COMPLEXITIES)[number]
    // Whole units only: the survey counts screens, interfaces and the like.
    const qty = Math.round(Number(String(raw).trim()))
    const clean = Number.isFinite(qty) && qty > 0 ? qty : 0

    if (clean === 0) {
      await db
        .delete(projectActivityQty)
        .where(
          and(
            eq(projectActivityQty.projectId, projectId),
            eq(projectActivityQty.activityId, activityId),
            eq(projectActivityQty.complexity, complexity),
          ),
        )
      continue
    }

    await db
      .insert(projectActivityQty)
      .values({ projectId, activityId, complexity, qty: clean })
      .onConflictDoUpdate({
        target: [
          projectActivityQty.projectId,
          projectActivityQty.activityId,
          projectActivityQty.complexity,
        ],
        set: { qty: clean },
      })
    filled++
    totalQty += clean
  }

  revalidatePath(`/projects/${projectId}`)
  return filled
    ? { ok: `บันทึกแล้ว ${filled} ช่อง รวม ${totalQty} หน่วย` }
    : { ok: 'บันทึกแล้ว — ยังไม่ได้กรอกจำนวนไว้เลย' }
}

/**
 * Stores the wording for the cells of one topic. Inputs arrive as
 * `detail_<activityId>_<L|M|H>`; blank means fall back to the generated
 * default. Only cells that already carry a quantity are touched.
 */
export async function saveActivityDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWriter()

  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return { error: 'ไม่พบโครงการ' }

  let saved = 0
  for (const [key, raw] of formData.entries()) {
    const match = /^detail_(\d+)_(L|M|H)$/.exec(key)
    if (!match) continue

    const detail = String(raw).trim()
    const { changes } = await db
      .update(projectActivityQty)
      .set({ detail: detail || null })
      .where(
        and(
          eq(projectActivityQty.projectId, projectId),
          eq(projectActivityQty.activityId, Number(match[1])),
          eq(projectActivityQty.complexity, match[2] as 'L' | 'M' | 'H'),
        ),
      )
    if (changes) saved++
  }

  revalidatePath(`/projects/${projectId}`)
  return saved
    ? { ok: `บันทึกข้อความ ${saved} รายการแล้ว`, nonce: Date.now() }
    : { error: 'ยังไม่ได้กรอกจำนวนของหัวข้อนี้ จึงยังแก้ข้อความไม่ได้' }
}

/** Clears every answer of the survey for this project. */
export async function clearActivityQuantities(formData: FormData) {
  await requireWriter()
  const projectId = Number(formData.get('projectId'))
  if (!Number.isInteger(projectId)) return
  await db
    .delete(projectActivityQty)
    .where(eq(projectActivityQty.projectId, projectId))
  revalidatePath(`/projects/${projectId}`)
}
