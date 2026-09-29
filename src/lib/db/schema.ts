import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const now = sql`(unixepoch())`

/* ---------------------------------------------------------------- auth */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'estimator', 'viewer'] })
    .notNull()
    .default('estimator'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().default(now),
})

/* ------------------------------------------------- standard matrix master */

/** A role column of the standard matrix (SA, BA, Developer, ...). */
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  /** true for Developer / Developer (Senior): the tech-stack multiplier applies. */
  stackMultiplied: integer('stack_multiplied', { mode: 'boolean' })
    .notNull()
    .default(false),
  ratePerMd: real('rate_per_md').notNull().default(8500),
  /** Drives the default day rate: senior 14,000, junior 8,500. */
  seniority: text('seniority', { enum: ['senior', 'junior'] })
    .notNull()
    .default('junior'),
  /**
   * How this role's man-days are estimated:
   *   item  — from the matrix, per keyed line item (bottom-up)
   *   phase — a share of the phase's Developer man-days (top-down)
   */
  scope: text('scope', { enum: ['item', 'phase'] })
    .notNull()
    .default('item'),
  /**
   * Target share of Developer man-days, from the methodology of the PSM
   * estimate. Used to compute phase-scoped roles, and as a sanity check for
   * item-scoped ones.
   */
  ratioOfDev: real('ratio_of_dev'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/** A row of the standard matrix, e.g. "1.1 List / Search" or "2. Dashboard". */
export const activities = sqliteTable(
  'activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    groupName: text('group_name'),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('MD'),
    /** What one unit of qty means, e.g. "ต่อหน้าจอ" or "ต่อโครงการ". */
    countUnit: text('count_unit').notNull().default('ต่อรายการ'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('activities_code_uq').on(t.code)],
)

/**
 * The count unit that means "once per project": rows marked with it must not be
 * multiplied by a quantity, which is what the v1 matrix could not express.
 */
export const ONCE_PER_PROJECT_UNIT = 'ต่อโครงการ'

export const COMPLEXITIES = ['L', 'M', 'H'] as const
export type Complexity = (typeof COMPLEXITIES)[number]

/** Activity x Complexity x Role -> manday. One cell of the standard matrix. */
export const matrixCells = sqliteTable(
  'matrix_cells',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    activityId: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    complexity: text('complexity', { enum: COMPLEXITIES }).notNull(),
    manday: real('manday').notNull().default(0),
  },
  (t) => [
    uniqueIndex('matrix_cells_uq').on(t.activityId, t.roleId, t.complexity),
    index('matrix_cells_activity_idx').on(t.activityId),
  ],
)

/** Technology stack multiplier, applied to roles with stackMultiplied = true. */
export const techStacks = sqliteTable('tech_stacks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  multiplier: real('multiplier').notNull().default(1),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/**
 * Multiplies on top of the technology stack, several at a time, e.g.
 * "Responsive Web" x1.15. Applies to the same roles as techStacks.
 */
export const stackModifiers = sqliteTable('stack_modifiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  multiplier: real('multiplier').notNull().default(1),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/* ------------------------------------------------------------ questionnaire */

/**
 * A named survey: the list of standard-matrix topics to ask about. The
 * estimator answers it per topic with a quantity at each complexity level, so
 * one topic can carry, say, three simple screens and one complex one.
 */
export const questionnaires = sqliteTable('questionnaires', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().default(now),
})

/** One topic of a survey, pointing at a row of the standard matrix. */
export const questionnaireActivities = sqliteTable(
  'questionnaire_activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    questionnaireId: integer('questionnaire_id')
      .notNull()
      .references(() => questionnaires.id, { onDelete: 'cascade' }),
    activityId: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    /** Extra guidance shown under the topic while answering. */
    helpText: text('help_text'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('questionnaire_activities_uq').on(t.questionnaireId, t.activityId),
  ],
)

/* ------------------------------------------------------------------ project */

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code'),
  name: text('name').notNull(),
  durationDays: integer('duration_days'),
  techStackId: integer('tech_stack_id').references(() => techStacks.id, {
    onDelete: 'set null',
  }),
  questionnaireId: integer('questionnaire_id').references(
    () => questionnaires.id,
    { onDelete: 'set null' },
  ),
  status: text('status', { enum: ['draft', 'in_review', 'approved'] })
    .notNull()
    .default('draft'),
  /** Contingency added on top of the computed cost, in percent. */
  bufferPercent: real('buffer_percent').notNull().default(0),
  /** Wizard progress, 1-based. */
  wizardStep: integer('wizard_step').notNull().default(1),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
})

/** Column A of the export: a phase / feature group. */
export const projectPhases = sqliteTable(
  'project_phases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('project_phases_project_idx').on(t.projectId)],
)

/** One keyed line item: an activity at a complexity, inside a phase. */
export const projectItems = sqliteTable(
  'project_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    phaseId: integer('phase_id')
      .notNull()
      .references(() => projectPhases.id, { onDelete: 'cascade' }),
    activityId: integer('activity_id').references(() => activities.id, {
      onDelete: 'set null',
    }),
    /** Column B of the export. */
    detail: text('detail').notNull(),
    complexity: text('complexity', { enum: COMPLEXITIES })
      .notNull()
      .default('M'),
    qty: real('qty').notNull().default(1),
    dueDatePlan: text('due_date_plan'),
    deliverables: text('deliverables'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('project_items_project_idx').on(t.projectId)],
)

/**
 * Manday per item per role. Seeded from the standard matrix on save; an
 * estimator may override a single cell, and overridden keeps it sticky.
 */
export const projectItemMandays = sqliteTable(
  'project_item_mandays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    itemId: integer('item_id')
      .notNull()
      .references(() => projectItems.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    manday: real('manday').notNull().default(0),
    overridden: integer('overridden', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [uniqueIndex('project_item_mandays_uq').on(t.itemId, t.roleId)],
)

/** Per-project rate and named resource per role. */
export const projectRoles = sqliteTable(
  'project_roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    resourceLabel: text('resource_label'),
    personName: text('person_name'),
    ratePerMd: real('rate_per_md'),
    included: integer('included', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('project_roles_uq').on(t.projectId, t.roleId)],
)

/** Modifiers chosen for this project; their multipliers compound. */
export const projectModifiers = sqliteTable(
  'project_modifiers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    modifierId: integer('modifier_id')
      .notNull()
      .references(() => stackModifiers.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('project_modifiers_uq').on(t.projectId, t.modifierId)],
)

/**
 * Survey answers: how many units of an activity this project needs at each
 * complexity level. Zero rows are not stored.
 */
export const projectActivityQty = sqliteTable(
  'project_activity_qty',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    activityId: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    complexity: text('complexity', { enum: COMPLEXITIES }).notNull(),
    qty: real('qty').notNull().default(0),
    /**
     * The wording to carry into the line item, and from there into the summary
     * and the Excel export. Null means use the generated default.
     */
    detail: text('detail'),
  },
  (t) => [
    uniqueIndex('project_activity_qty_uq').on(
      t.projectId,
      t.activityId,
      t.complexity,
    ),
  ],
)

export type User = typeof users.$inferSelect
export type Role = typeof roles.$inferSelect
export type Activity = typeof activities.$inferSelect
export type MatrixCell = typeof matrixCells.$inferSelect
export type TechStack = typeof techStacks.$inferSelect
export type StackModifier = typeof stackModifiers.$inferSelect
export type Project = typeof projects.$inferSelect
export type ProjectItem = typeof projectItems.$inferSelect
