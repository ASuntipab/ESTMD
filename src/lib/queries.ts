import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { db } from './db'
import {
  activities,
  matrixCells,
  projectItemMandays,
  projectItems,
  projectModifiers,
  projectPhases,
  projectRoles,
  projects,
  projectActivityQty,
  questionnaireActivities,
  questionnaires,
  roles,
  stackModifiers,
  techStacks,
} from './db/schema'
import {
  buildMatrixLookup,
  effectiveMultiplier,
  type RoleLike,
} from './estimate'

/** The five roles the standard matrix has values for, then the extra columns. */
export async function listRoles(): Promise<RoleLike[]> {
  return db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      stackMultiplied: roles.stackMultiplied,
      ratePerMd: roles.ratePerMd,
      seniority: roles.seniority,
      scope: roles.scope,
      ratioOfDev: roles.ratioOfDev,
      sortOrder: roles.sortOrder,
    })
    .from(roles)
    .where(eq(roles.active, true))
    .orderBy(asc(roles.sortOrder), asc(roles.id))
}

export async function listActivities() {
  return db
    .select()
    .from(activities)
    .orderBy(asc(activities.sortOrder), asc(activities.id))
}

/** Count units already in use, for the suggestion list in the editor. */
export async function listCountUnits() {
  const rows = await db
    .selectDistinct({ countUnit: activities.countUnit })
    .from(activities)
    .orderBy(asc(activities.countUnit))
  return rows.map((r) => r.countUnit).filter(Boolean)
}

export async function getActivity(id: number) {
  const [row] = await db.select().from(activities).where(eq(activities.id, id))
  return row ?? null
}

export async function listMatrixCells() {
  return db.select().from(matrixCells)
}

export async function getMatrixLookup() {
  return buildMatrixLookup(await listMatrixCells())
}

/** roleId_complexity -> manday, for the editor grid of a single activity. */
export async function getActivityCellMap(activityId: number) {
  const rows = await db
    .select()
    .from(matrixCells)
    .where(eq(matrixCells.activityId, activityId))
  return new Map(rows.map((r) => [`${r.roleId}_${r.complexity}`, r.manday]))
}

export async function listTechStacks({ includeInactive = false } = {}) {
  const rows = await db
    .select()
    .from(techStacks)
    .orderBy(asc(techStacks.sortOrder), asc(techStacks.id))
  return includeInactive ? rows : rows.filter((s) => s.active)
}

export async function listStackModifiers({ includeInactive = false } = {}) {
  const rows = await db
    .select()
    .from(stackModifiers)
    .orderBy(asc(stackModifiers.sortOrder), asc(stackModifiers.id))
  return includeInactive ? rows : rows.filter((m) => m.active)
}

/* --------------------------------------------------------------- questionnaire */

export async function listQuestionnaires() {
  return db
    .select()
    .from(questionnaires)
    .orderBy(asc(questionnaires.name))
}

/**
 * A survey with its topics resolved against the standard matrix, so the
 * answering screen can show each topic's count unit and group.
 */
export async function getQuestionnaire(id: number) {
  const [head] = await db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.id, id))
  if (!head) return null

  const topics = await db
    .select({
      id: questionnaireActivities.id,
      activityId: questionnaireActivities.activityId,
      helpText: questionnaireActivities.helpText,
      sortOrder: questionnaireActivities.sortOrder,
      code: activities.code,
      name: activities.name,
      groupName: activities.groupName,
      countUnit: activities.countUnit,
      notes: activities.notes,
      active: activities.active,
    })
    .from(questionnaireActivities)
    .innerJoin(activities, eq(activities.id, questionnaireActivities.activityId))
    .where(eq(questionnaireActivities.questionnaireId, id))
    .orderBy(asc(questionnaireActivities.sortOrder), asc(activities.sortOrder))

  return { ...head, topics }
}

export type SurveyTopic = NonNullable<
  Awaited<ReturnType<typeof getQuestionnaire>>
>['topics'][number]

/** The quantities this project answered, keyed activityId_complexity. */
export async function getProjectActivityQty(projectId: number) {
  const rows = await db
    .select()
    .from(projectActivityQty)
    .where(eq(projectActivityQty.projectId, projectId))
  return new Map(
    rows.map((r) => [
      `${r.activityId}_${r.complexity}`,
      { qty: r.qty, detail: r.detail },
    ]),
  )
}

/** One answered cell of the survey: a quantity and an optional wording. */
export type AnsweredCell = { qty: number; detail: string | null }


/* ------------------------------------------------------------------- projects */

export async function listProjects() {
  return db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      status: projects.status,
      wizardStep: projects.wizardStep,
      updatedAt: projects.updatedAt,
      techStackName: techStacks.name,
    })
    .from(projects)
    .leftJoin(techStacks, eq(projects.techStackId, techStacks.id))
    .orderBy(asc(projects.status), asc(projects.name))
}

export async function getProject(id: number) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  return row ?? null
}

/** Everything the wizard, the summary screen and the export need. */
export async function getProjectDetail(id: number) {
  const project = await getProject(id)
  if (!project) return null

  const [phases, items, mandays, projectRoleRows, allRoles, allActivities] =
    await Promise.all([
      db
        .select()
        .from(projectPhases)
        .where(eq(projectPhases.projectId, id))
        .orderBy(asc(projectPhases.sortOrder), asc(projectPhases.id)),
      db
        .select()
        .from(projectItems)
        .where(eq(projectItems.projectId, id))
        .orderBy(asc(projectItems.sortOrder), asc(projectItems.id)),
      db
        .select({
          itemId: projectItemMandays.itemId,
          roleId: projectItemMandays.roleId,
          manday: projectItemMandays.manday,
          overridden: projectItemMandays.overridden,
        })
        .from(projectItemMandays)
        .innerJoin(
          projectItems,
          eq(projectItems.id, projectItemMandays.itemId),
        )
        .where(eq(projectItems.projectId, id)),
      db
        .select()
        .from(projectRoles)
        .where(eq(projectRoles.projectId, id)),
      listRoles(),
      listActivities(),
    ])

  const stack = project.techStackId
    ? ((await db
        .select()
        .from(techStacks)
        .where(eq(techStacks.id, project.techStackId)))[0] ?? null)
    : null

  const modifiers = await db
    .select({
      id: stackModifiers.id,
      name: stackModifiers.name,
      multiplier: stackModifiers.multiplier,
    })
    .from(projectModifiers)
    .innerJoin(stackModifiers, eq(stackModifiers.id, projectModifiers.modifierId))
    .where(eq(projectModifiers.projectId, id))
    .orderBy(asc(stackModifiers.sortOrder))

  return {
    project,
    phases,
    items,
    mandays,
    projectRoles: projectRoleRows,
    roles: allRoles,
    activities: allActivities,
    /** The survey this project answers, and the answers themselves. */
    survey: project.questionnaireId
      ? await getQuestionnaire(project.questionnaireId)
      : null,
    activityQty: await getProjectActivityQty(id),
    stack,
    modifiers,
    /** Stack multiplier alone, for showing the two parts separately. */
    stackMultiplier: stack?.multiplier ?? 1,
    /** Stack times every modifier: what actually multiplies the man-days. */
    effectiveMultiplier: effectiveMultiplier(
      stack?.multiplier,
      modifiers.map((m) => m.multiplier),
    ),
  }
}

export type ProjectDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectDetail>>
>
