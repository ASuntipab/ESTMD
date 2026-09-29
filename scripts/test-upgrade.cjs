/**
 * Proves the v1 -> v2 upgrade keeps existing estimates intact:
 *   1. build a database at migration 0000 only (the v1 schema)
 *   2. put v1-shaped master data in it, plus a project that estimated 11.2
 *   3. run the real migrate + seed scripts
 *   4. check the renamed activity kept its id and the estimate still resolves
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const Database = require('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3')
const { migrate } = require('drizzle-orm/better-sqlite3/migrator')

const ROOT = path.resolve(__dirname, '..')
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-'))
const dbFile = path.join(work, 'estmanday.db')

/* ---- 1. v1 schema: a migrations folder holding only the first migration --- */

const v1Migrations = path.join(work, 'drizzle-v1')
fs.mkdirSync(path.join(v1Migrations, 'meta'), { recursive: true })
const journal = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'drizzle/meta/_journal.json'), 'utf8'),
)
const first = journal.entries[0]
fs.copyFileSync(
  path.join(ROOT, 'drizzle', `${first.tag}.sql`),
  path.join(v1Migrations, `${first.tag}.sql`),
)
fs.copyFileSync(
  path.join(ROOT, 'drizzle/meta', `${first.tag.slice(0, 4)}_snapshot.json`),
  path.join(v1Migrations, 'meta', `${first.tag.slice(0, 4)}_snapshot.json`),
)
fs.writeFileSync(
  path.join(v1Migrations, 'meta/_journal.json'),
  JSON.stringify({ ...journal, entries: [first] }, null, 2),
)

let db = new Database(dbFile)
db.pragma('journal_mode = WAL')
migrate(drizzle(db), { migrationsFolder: v1Migrations })

const columns = () =>
  db
    .prepare('PRAGMA table_info(activities)')
    .all()
    .map((c) => c.name)
console.log('1. v1 schema built. activities columns:', columns().join(', '))
if (columns().includes('count_unit')) throw new Error('expected no count_unit yet')

/* ------------------------- 2. v1-shaped data + a project ------------------ */

db.exec(`
  INSERT INTO users (email, name, password_hash, role)
    VALUES ('old@pttdigital.com', 'Existing User', 'x', 'admin');
  INSERT INTO roles (code, name, stack_multiplied, rate_per_md, sort_order) VALUES
    ('SA','SA',0,8500,10), ('BA','BA',0,8500,20),
    ('DEV_SR','Developer (Senior)',1,14000,30),
    ('DEV','Developer',1,8500,40), ('TESTER','Tester',0,8500,50),
    ('ABAPER','ABAPer',0,8500,60), ('FI_AR','FI-AR',0,8500,80);
  INSERT INTO activities (code, group_name, name, unit, sort_order) VALUES
    ('1.1','CRUD','List / Search','MD',10),
    ('11.2','Testing','Prepare Training Material / User Manual','MD',220);
  -- v1 kept the modifiers inside the stack table
  INSERT INTO tech_stacks (name, multiplier, note, sort_order) VALUES
    ('ASP.NET MVC / ASP.NET Core', 1, 'baseline', 20),
    ('Responsive Web (เพิ่มจาก Desktop)', 1.15, 'modifier in v1', 30),
    ('Stack ใหม่ที่ทีมไม่คุ้นเคย', 1.4, 'modifier in v1', 60);
`)

const trainingId = db
  .prepare('SELECT id FROM activities WHERE code = ?')
  .get('11.2').id
const stackId = db
  .prepare('SELECT id FROM tech_stacks WHERE name LIKE ?')
  .get('Responsive%').id

db.exec(`
  INSERT INTO projects (name, code, tech_stack_id, owner_id, wizard_step)
    VALUES ('โครงการเดิมจาก v1', 'OLD-1', ${stackId}, 1, 3);
  INSERT INTO project_phases (project_id, name, sort_order) VALUES (1, 'Training', 10);
  INSERT INTO project_items
    (project_id, phase_id, activity_id, detail, complexity, qty, sort_order)
    VALUES (1, 1, ${trainingId}, 'ทำคู่มือผู้ใช้', 'M', 1, 10);
  INSERT INTO project_item_mandays (item_id, role_id, manday, overridden) VALUES
    (1, 2, 5, 0), (1, 5, 2, 1);
`)
console.log(
  `2. v1 data in place. activity 11.2 has id ${trainingId}; ` +
    `project 1 estimated it with 1 item and 2 man-day cells ` +
    `(one of them an override)`,
)
db.close()

/* --------------------------- 3. the real upgrade -------------------------- */

const run = (script) =>
  execFileSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_PATH: dbFile, NODE_ENV: 'production' },
    encoding: 'utf8',
  })

console.log('\n3. running scripts/migrate.cjs')
process.stdout.write(
  run('scripts/migrate.cjs')
    .split('\n')
    .map((l) => (l ? `   ${l}` : l))
    .join('\n'),
)
console.log('   running scripts/seed.cjs')
process.stdout.write(
  run('scripts/seed.cjs')
    .split('\n')
    .map((l) => (l ? `   ${l}` : l))
    .join('\n'),
)

/* ------------------------------- 4. verify ------------------------------- */

db = new Database(dbFile, { readonly: true })
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}`)
  if (!ok) {
    console.log(`         expected ${JSON.stringify(expected)}`)
    process.exitCode = 1
  }
}

console.log('\n4. checks')

check(
  'count_unit column added',
  columns().includes('count_unit'),
  true,
)

const renamed = db
  .prepare('SELECT id, code, group_name, count_unit FROM activities WHERE id = ?')
  .get(trainingId)
check('activity kept its id after the rename', renamed.id, trainingId)
check('activity code renumbered 11.2 -> 15.1', renamed.code, '15.1')
check('activity left the Testing group', renamed.group_name, 'Deployment & Training')
check('activity got a count unit', renamed.count_unit, 'ต่อโครงการ')
check(
  'no duplicate row was created for 11.2',
  db.prepare("SELECT count(*) c FROM activities WHERE code = '11.2'").get().c,
  0,
)

const item = db
  .prepare('SELECT activity_id, detail, qty FROM project_items WHERE id = 1')
  .get()
check('the estimate still points at that activity', item.activity_id, trainingId)
check('the keyed detail is untouched', item.detail, 'ทำคู่มือผู้ใช้')

const mandays = db
  .prepare(
    'SELECT role_id, manday, overridden FROM project_item_mandays WHERE item_id = 1 ORDER BY role_id',
  )
  .all()
check('man-days and the override survived', mandays, [
  { role_id: 2, manday: 5, overridden: 0 },
  { role_id: 5, manday: 2, overridden: 1 },
])

check(
  'the project still resolves its v1 stack',
  db
    .prepare(
      'SELECT t.name FROM projects p JOIN tech_stacks t ON t.id = p.tech_stack_id WHERE p.id = 1',
    )
    .get().name,
  'Responsive Web (เพิ่มจาก Desktop)',
)
check(
  'that stack is now retired from the pick list',
  db
    .prepare('SELECT active FROM tech_stacks WHERE name LIKE ?')
    .get('Responsive%').active,
  0,
)
check(
  'stacks still offered',
  db
    .prepare('SELECT count(*) c FROM tech_stacks WHERE active = 1')
    .get().c,
  4,
)
check(
  'modifiers now available separately',
  db
    .prepare('SELECT name FROM stack_modifiers ORDER BY sort_order')
    .all()
    .map((m) => m.name),
  ['Responsive Web (เพิ่มจาก Desktop)', 'Stack ใหม่ที่ทีมไม่คุ้นเคย'],
)
check(
  'activity count after upgrade',
  db.prepare('SELECT count(*) c FROM activities').get().c,
  50,
)

/* --------------------------------------------------- round-2 (v3) additions */

check(
  'roles gained seniority / scope / ratio columns',
  db
    .prepare('PRAGMA table_info(roles)')
    .all()
    .map((c) => c.name)
    .filter((n) => ['seniority', 'scope', 'ratio_of_dev'].includes(n))
    .sort(),
  ['ratio_of_dev', 'scope', 'seniority'],
)
check(
  'projects gained the buffer column',
  db
    .prepare('PRAGMA table_info(projects)')
    .all()
    .some((c) => c.name === 'buffer_percent'),
  true,
)
check(
  'the estimate keeps its rate after the role table was reseeded',
  db.prepare("SELECT rate_per_md FROM roles WHERE code = 'DEV'").get()
    .rate_per_md,
  8500,
)
check(
  'ABAPer rate corrected to the PSM rate table',
  db.prepare("SELECT rate_per_md FROM roles WHERE code = 'ABAPER'").get()
    .rate_per_md,
  7500,
)
check(
  'target ratios loaded from the master file',
  db
    .prepare(
      "SELECT code, ratio_of_dev FROM roles WHERE code IN ('SA','TESTER','PM') ORDER BY code",
    )
    .all(),
  [
    { code: 'PM', ratio_of_dev: 0.15 },
    { code: 'SA', ratio_of_dev: 0.3 },
    { code: 'TESTER', ratio_of_dev: 0.35 },
  ],
)
check(
  'every role defaults to item scope, so existing numbers do not move',
  db.prepare("SELECT count(*) c FROM roles WHERE scope <> 'item'").get().c,
  0,
)
check(
  'the role dropped in v3 is deactivated, not deleted',
  db.prepare("SELECT active FROM roles WHERE code = 'FI_AR'").get().active,
  0,
)
check(
  'the question-based survey tables are gone',
  db
    .prepare(
      "SELECT count(*) c FROM sqlite_master WHERE type='table' AND name IN ('questions','question_options','project_answers')",
    )
    .get().c,
  0,
)
check(
  'the activity-based survey tables exist',
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('questionnaire_activities','project_activity_qty') ORDER BY name",
    )
    .all()
    .map((r) => r.name),
  ['project_activity_qty', 'questionnaire_activities'],
)
check(
  'the seeded surveys carry their topics',
  db
    .prepare(
      `SELECT q.name, count(qa.id) topics
         FROM questionnaires q
         LEFT JOIN questionnaire_activities qa ON qa.questionnaire_id = q.id
        GROUP BY q.id ORDER BY q.name`,
    )
    .all(),
  [
    { name: 'งานพัฒนาระบบใหม่ (Greenfield)', topics: 44 },
    { name: 'ทุกหัวข้อ (ค่าเริ่มต้น)', topics: 50 },
  ],
)
check(
  'roles added in v3 are present',
  db
    .prepare(
      "SELECT count(*) c FROM roles WHERE code IN ('AZURE','DEVOPS','DATA_LAKE','SAP_CONSULT','SAP_MASTER','PIS','PTT_ZEUS')",
    )
    .get().c,
  7,
)

db.close()
fs.rmSync(work, { recursive: true, force: true })
console.log(
  process.exitCode ? '\nUPGRADE TEST FAILED' : '\nUPGRADE TEST PASSED',
)
