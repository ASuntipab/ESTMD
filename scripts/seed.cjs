/**
 * Loads master data into the SQLite file: the standard matrix (roles,
 * activities, man-day cells, technology-stack multipliers), a starter
 * questionnaire, and the initial users.
 *
 *   node scripts/migrate.cjs && node scripts/seed.cjs
 *
 * Safe to re-run: master rows are upserted on their natural key and existing
 * users are left alone. Plain JavaScript and raw SQL on purpose, so the same
 * file runs on a server that has no TypeScript toolchain.
 *
 * Environment:
 *   DATABASE_PATH    SQLite file (default ./data/estmanday.db)
 *   ADMIN_EMAIL      first admin account (default admin@pttdigital.com)
 *   ADMIN_PASSWORD   its password; required the first time in production
 */
require('./load-env.cjs')

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const root = path.resolve(__dirname, '..')
const file = path.resolve(root, process.env.DATABASE_PATH || './data/estmanday.db')
const matrix = require(path.join(root, 'src', 'lib', 'db', 'standard-matrix.json'))

if (!fs.existsSync(file)) {
  throw new Error(`database not found: ${file}\nrun "node scripts/migrate.cjs" first`)
}

const db = new Database(file)
db.pragma('foreign_keys = ON')

/**
 * Roles from earlier matrix versions that v3 dropped. They are deactivated
 * rather than deleted, so an estimate that used one keeps its numbers.
 */
const RETIRED_ROLES = ['FI_AR']

const seedAll = db.transaction(() => {
  /* ------------------------------------------------------------------ roles */

  // Every role, its rate, seniority, scope and target ratio now come from the
  // ตารางบทบาท sheet of the master file.
  const upsertRole = db.prepare(`
    INSERT INTO roles
      (code, name, stack_multiplied, rate_per_md, seniority, scope,
       ratio_of_dev, sort_order)
    VALUES (@code, @name, @stackMultiplied, @ratePerMd, @seniority, @scope,
            @ratioOfDev, @sortOrder)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      stack_multiplied = excluded.stack_multiplied,
      rate_per_md = excluded.rate_per_md,
      seniority = excluded.seniority,
      scope = excluded.scope,
      ratio_of_dev = excluded.ratio_of_dev,
      sort_order = excluded.sort_order,
      active = 1
  `)

  for (const role of matrix.roles) {
    upsertRole.run({
      code: role.code,
      name: role.name,
      stackMultiplied: role.stackMultiplied ? 1 : 0,
      ratePerMd: role.ratePerMd,
      seniority: role.seniority,
      scope: role.scope,
      ratioOfDev: role.ratioOfDev,
      sortOrder: role.sortOrder,
    })
  }

  const retireRole = db.prepare(
    'UPDATE roles SET active = 0 WHERE code = ? AND active = 1',
  )
  for (const code of RETIRED_ROLES) {
    if (retireRole.run(code).changes) {
      console.log(`  retired role ${code} (not in ${matrix.source})`)
    }
  }

  const roleIdByCode = new Map(
    db.prepare('SELECT id, code FROM roles').all().map((r) => [r.code, r.id]),
  )

  /* ------------------------------------------------- activities and MD cells */

  // Codes that were renumbered between matrix versions. Renaming in place keeps
  // the activity id, so estimates already keyed against it stay linked.
  const RENAMED_CODES = {
    // v2: moved out of the Testing group into "15. Deployment & Training".
    '11.2': '15.1',
  }
  const renameCode = db.prepare('UPDATE activities SET code = ? WHERE code = ?')
  const codeExists = db.prepare('SELECT 1 FROM activities WHERE code = ?')
  for (const [from, to] of Object.entries(RENAMED_CODES)) {
    if (codeExists.get(from) && !codeExists.get(to)) {
      renameCode.run(to, from)
      console.log(`  renamed activity ${from} -> ${to}`)
    }
  }

  const upsertActivity = db.prepare(`
    INSERT INTO activities
      (code, group_name, name, unit, count_unit, notes, sort_order)
    VALUES (@code, @groupName, @name, @unit, @countUnit, @notes, @sortOrder)
    ON CONFLICT(code) DO UPDATE SET
      group_name = excluded.group_name,
      name = excluded.name,
      unit = excluded.unit,
      count_unit = excluded.count_unit,
      notes = excluded.notes,
      sort_order = excluded.sort_order
  `)
  const activityIdByCode = db.prepare('SELECT id FROM activities WHERE code = ?')
  const upsertCell = db.prepare(`
    INSERT INTO matrix_cells (activity_id, role_id, complexity, manday)
    VALUES (@activityId, @roleId, @complexity, @manday)
    ON CONFLICT(activity_id, role_id, complexity) DO UPDATE SET
      manday = excluded.manday
  `)

  let cellCount = 0
  for (const activity of matrix.activities) {
    upsertActivity.run({
      code: activity.code,
      groupName: activity.groupName,
      name: activity.name,
      unit: activity.unit,
      countUnit: activity.countUnit ?? 'ต่อรายการ',
      notes: activity.notes ?? null,
      sortOrder: activity.sortOrder,
    })
    const { id: activityId } = activityIdByCode.get(activity.code)

    for (const cell of activity.cells) {
      const roleId = roleIdByCode.get(cell.role)
      if (!roleId) continue
      upsertCell.run({
        activityId,
        roleId,
        complexity: cell.complexity,
        manday: cell.manday,
      })
      cellCount++
    }
  }

  // Rows the master file no longer has are deactivated, not deleted: they stop
  // being offered when keying, while estimates that already use them keep both
  // their reference and their man-days.
  const liveCodes = new Set(matrix.activities.map((a) => a.code))
  for (const row of db.prepare('SELECT id, code, name FROM activities WHERE active = 1').all()) {
    if (liveCodes.has(row.code)) continue
    db.prepare('UPDATE activities SET active = 0 WHERE id = ?').run(row.id)
    console.log(`  retired activity ${row.code} ${row.name} (not in ${matrix.source})`)
  }

  /* ------------------------------------------------------------ tech stacks */

  const upsertStack = db.prepare(`
    INSERT INTO tech_stacks (name, multiplier, note, sort_order)
    VALUES (@name, @multiplier, @note, @sortOrder)
    ON CONFLICT(name) DO UPDATE SET
      multiplier = excluded.multiplier,
      note = excluded.note,
      sort_order = excluded.sort_order
  `)
  for (const stack of matrix.techStacks) {
    upsertStack.run({
      name: stack.name,
      multiplier: stack.multiplier,
      note: stack.note,
      sortOrder: stack.sortOrder,
    })
  }

  /* -------------------------------------------------------------- modifiers */

  const upsertModifier = db.prepare(`
    INSERT INTO stack_modifiers (name, multiplier, note, sort_order)
    VALUES (@name, @multiplier, @note, @sortOrder)
    ON CONFLICT(name) DO UPDATE SET
      multiplier = excluded.multiplier,
      note = excluded.note,
      sort_order = excluded.sort_order
  `)
  for (const modifier of matrix.modifiers ?? []) {
    upsertModifier.run({
      name: modifier.name,
      multiplier: modifier.multiplier,
      note: modifier.note,
      sortOrder: modifier.sortOrder,
    })
  }

  // v1 kept the modifiers in the stack table; retire those rows so they are not
  // offered as a stack any more. Projects that picked one keep their reference.
  const retireStack = db.prepare(
    'UPDATE tech_stacks SET active = 0 WHERE name = ? AND active = 1',
  )
  for (const modifier of matrix.modifiers ?? []) {
    if (retireStack.run(modifier.name).changes) {
      console.log(`  retired tech stack "${modifier.name}" (now a modifier)`)
    }
  }

  /* ----------------------------------------------------------- questionnaire */

  // A survey is just the list of matrix topics to ask about. The default one
  // asks every topic; narrower ones are made in the app.
  const SURVEYS = [
    {
      name: 'ทุกหัวข้อ (ค่าเริ่มต้น)',
      description:
        'ถามทุกหัวข้อใน Standard Matrix — แต่ละหัวข้อกรอกจำนวนได้ทั้งระดับ L, M และ H พร้อมกัน',
      codes: matrix.activities.map((a) => a.code),
    },
    {
      name: 'งานพัฒนาระบบใหม่ (Greenfield)',
      description:
        'หัวข้อที่ใช้บ่อยกับโครงการพัฒนาใหม่ ไม่รวมกลุ่มยกเครื่องระบบเดิม',
      codes: matrix.activities
        .map((a) => a.code)
        .filter((code) => !code.startsWith('16.')),
    },
  ]

  const findSurvey = db.prepare('SELECT id FROM questionnaires WHERE name = ?')
  const insertSurvey = db.prepare(
    'INSERT INTO questionnaires (name, description) VALUES (?, ?)',
  )
  const insertTopic = db.prepare(`
    INSERT INTO questionnaire_activities
      (questionnaire_id, activity_id, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(questionnaire_id, activity_id) DO NOTHING
  `)

  for (const survey of SURVEYS) {
    if (findSurvey.get(survey.name)) continue
    const { lastInsertRowid: surveyId } = insertSurvey.run(
      survey.name,
      survey.description,
    )
    let order = 0
    let added = 0
    for (const code of survey.codes) {
      const activity = activityIdByCode.get(code)
      if (!activity) continue
      insertTopic.run(surveyId, activity.id, (order += 10))
      added++
    }
    console.log(`  survey "${survey.name}" (${added} topics)`)
  }

  return {
    roles: matrix.roles.length,
    cells: cellCount,
    activities: matrix.activities.length,
  }
})

/* ------------------------------------------------------------------- users */

function seedUsers() {
  const findUser = db.prepare('SELECT id FROM users WHERE email = ?')
  const insertUser = db.prepare(`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (?, ?, ?, ?)
  `)

  const isProduction = process.env.NODE_ENV === 'production'
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pttdigital.com').toLowerCase()

  const accounts = [
    {
      email: adminEmail,
      name: 'System Admin',
      role: 'admin',
      password: process.env.ADMIN_PASSWORD,
      fallback: 'Admin@1234',
    },
  ]

  // The demo estimator exists for local development only.
  if (!isProduction) {
    accounts.push({
      email: 'estimator@pttdigital.com',
      name: 'Estimator',
      role: 'estimator',
      password: undefined,
      fallback: 'Estimate@1234',
    })
  }

  for (const account of accounts) {
    if (findUser.get(account.email)) continue

    let password = account.password
    let generated = false
    if (!password) {
      if (isProduction) {
        // Never fall back to a published password on a real server.
        password = crypto.randomBytes(12).toString('base64url')
        generated = true
      } else {
        password = account.fallback
      }
    }

    insertUser.run(
      account.email,
      account.name,
      bcrypt.hashSync(password, 10),
      account.role,
    )

    if (generated) {
      console.log(
        `  user ${account.email} created with a generated password: ${password}`,
      )
      console.log('  ^ copy it now and change it after the first sign-in')
    } else {
      console.log(`  user ${account.email} / ${password}`)
    }
  }
}

console.log(`seeding master data into ${file}`)
const { roles, cells, activities: activityCount } = seedAll()
seedUsers()
db.close()
console.log(`done: ${roles} roles, ${activityCount} activities, ${cells} matrix cells`)
