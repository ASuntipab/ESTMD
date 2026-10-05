/**
 * Loads the New PASS estimate (SR0000601) as a project, one line item per
 * function of "Estimate_PASS Requirement ระบบ PASS_AI_Assisted.xlsx"
 * (sheets Funct. Req., Out-Out, Req. and the scope assumptions). Only the
 * scope comes from that file: every man-day is the standard matrix value.
 *
 *   node scripts/import-new-pass.cjs           create, or refresh if untouched
 *   node scripts/import-new-pass.cjs --force   replace even if edited on the web
 *
 * Runs on every production start, so it never overwrites work: a project that
 * was edited on the web (updated_at moved, or a man-day overridden) is left
 * alone unless --force is given. Plain JavaScript and raw SQL like seed.cjs,
 * because the server has no TypeScript toolchain.
 *
 * Survey answers (project_activity_qty) are deliberately not written: several
 * lines share an activity and complexity, and "สร้างรายการ" would fold them
 * into one line and count them twice.
 */
require('./load-env.cjs')

const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

const root = path.resolve(__dirname, '..')
const file = path.resolve(root, process.env.DATABASE_PATH || './data/estmanday.db')
const force = process.argv.includes('--force')

if (!fs.existsSync(file)) {
  throw new Error(`database not found: ${file}\nrun "node scripts/migrate.cjs" first`)
}

const ONCE_PER_PROJECT_UNIT = 'ต่อโครงการ'

const PROJECT = {
  code: 'SR0000601-PASS',
  name: 'โครงการ New PASS',
  durationDays: 180,
  bufferPercent: 10,
  // Angular frontend + .NET Web API, both familiar to the team.
  techStack: 'ReactJS / AngularJS (ทีมคุ้นเคย)',
  // Req. 4: Responsive Design, and PASS on mobile in Funct. Req.
  modifiers: ['Responsive Web (เพิ่มจาก Desktop)'],
  questionnaire: 'ทุกหัวข้อ (ค่าเริ่มต้น)',
}

/**
 * [activity code, complexity, qty, detail, deliverables?]. qty is in the
 * activity's count unit; the detail lists what was counted.
 */
const PHASES = [
  {
    name: '1. Initiation & Requirement',
    items: [
      ['18.1', 'M', 1, 'Kick-off โครงการและจัดทำแผนงาน (PPS / Project Plan)', 'PPS, Kick-off Presentation'],
      ['10.1', 'H', 2, 'Get Requirement โมดูลใหม่ (2 โมดูล): การขายใหม่ Bulk Drum / ค่าบรรจุถัง AVGAS / Batch และ Out-Out H018 แบบ All-in-one'],
      ['10.1', 'M', 4, 'Get Requirement โมดูลเดิมที่ปรับปรุง (4 โมดูล): Into-Plane Transaction, Master Data & Customer Information, Report, User / Role / E-mail / Log'],
      ['10.2', 'H', 2, 'Business Blueprint & To-Be Workflow โมดูลใหม่ (2 โมดูล): การขายใหม่, Out-Out', 'To-Be Workflow'],
      ['10.2', 'M', 4, 'Business Blueprint & To-Be Workflow โมดูลเดิม (4 โมดูล): Into-Plane Transaction, Master Data, Report, User / Role / E-mail / Log', 'To-Be Workflow'],
      ['10.4', 'H', 1, 'System Requirement Spec (BA) และ Design Spec (SA / DEV)', 'SRS, SDS'],
    ],
  },
  {
    name: '2. Design & Environment',
    items: [
      ['9', 'H', 1, 'Init Project Structure: API Controller + Database Schema (List Search, Action Log, SendMail Log) และ Frontend Angular + Theme Layout (Table List, Filter, Export Excel)'],
      ['10.3', 'L', 20, 'Design Mockup เฉพาะหน้าจอใหม่ (20 หน้า): การขายใหม่ 10, Out-Out 5, Approval 2, Customer Information 1, Price Advice 1, Announcement 1 — หน้าจอเดิมใช้ Theme กลาง', 'Mockup'],
      ['8', 'M', 3, 'Init Server ภายใต้ OR Security (3 environment): Dev, SIT, UAT'],
      ['17.1', 'M', 2, 'CI/CD Pipeline แบบ DevOps + Container (2 pipeline): Frontend, Backend'],
      ['17.3', 'M', 5, 'Firewall / Network Request (5 ปลายทาง): SAP OR, SAP ปตท., WSO2 (PIS), AD (OR / PTTPLC), Thappline'],
    ],
  },
  {
    name: '3. Into-Plane Transaction',
    items: [
      ['1.1', 'M', 2, 'First List (2 หน้า): หน้าสร้าง (ระบุจำนวนครั้งที่เติม, ค้นหาลูกค้าแบบ dropdown ไม่ต้องใส่ 00) และหน้ารวม / Post First List'],
      ['1.1', 'L', 1, 'First List Archive: แสดง First List ที่หมดอายุ'],
      ['1.1', 'H', 2, 'Second List (2 หน้า): หน้าสร้าง (หลายคลังในเลขเดียว, ลูกค้า Care Of, Formula Price) และหน้ารวม / Post Second List แยกเลขตาม plant'],
      ['1.1', 'M', 1, 'DR Layout Template: CRUD + List / Search'],
      ['1.3', 'H', 2, 'Create DR ผ่าน Web (2 หน้าจอ): render ตาม Layout Template, DR ขาจร / ซ้อมรบ, Copy DR / Copy Template, Offset DR กับยอด Defuel, ตรวจ Flight No. กับสายการบิน และ Destination ในประเทศ / ต่างประเทศ'],
      ['1.1', 'H', 3, 'Post to SAP (3 หน้า): หน้ารวม DR (Post / Invoice / Reverse / Delete / YORE / Cancel / Update CN-DN, Post หลายรายการ, ช่อง Cash Sale), Popup Check Stock, Popup ราคาก่อนออก Invoice'],
      ['1.1', 'M', 2, 'DR Template (2 หน้า): หน้ารวม Template และหน้าแก้ไข (กำหนดจำนวนรายการต่อหน้าตาม Role)'],
      ['1.2', 'M', 1, 'DR Upload: นำเข้า text file uplift report จาก BAFS (รวมไว้ในหน้า Post to SAP)'],
      ['1.2', 'H', 1, 'XML Invoice List สำหรับลูกค้า DLA: Import / Generate XML, Select DR, Change Flag, Reverse'],
      ['1.1', 'M', 1, 'Announcement แจ้ง plant ที่เกี่ยวข้อง พร้อมดูประวัติย้อนหลัง'],
      ['13.1', 'M', 1, 'แนบรูป / ไฟล์ใน Announcement'],
      ['1.1', 'M', 1, 'Customer Information: ตรวจวงเงินลูกค้า OR และ ปตท. (วงเงินทั้งหมด, Credit Limit, วงเงินคงเหลือ, CCA)'],
    ],
  },
  {
    name: '4. การขายใหม่, Workflow & เอกสาร',
    items: [
      ['1.1', 'H', 6, 'การขายใหม่ (6 หน้าจอ): Bulk Drum ของ OR (ใบเสนอราคา, Order), Bulk Drum ของ ปตท. (Contract, Order), ค่าบรรจุถัง 200 ลิตร + ค่าขนส่ง AVGAS untax (Order → INV), การขายแบบ Batch ที่ BAFS สุวรรณภูมิ (Order → INV)'],
      ['1.4', 'H', 3, 'Approval Workflow (3 flow): อนุมัติ Formula Price / ราคาขาย Second List ตามอำนาจ, อนุมัติ Margin Out-Out ที่ต่ำกว่าเกณฑ์, Batch Order ลูกค้าสั่ง → ผู้จัดการเขตอนุมัติ (revise ได้) — รองรับ Delegate จาก PIS'],
      ['1.5', 'M', 8, 'E-mail แจ้งเตือน (8 เหตุการณ์): First List ถึง plant, Second List ถึง plant แบบ group mail, First List ใกล้หมดอายุ, Second List ใกล้หมดอายุถึง Sales Rep + ผู้รับเพิ่ม, ไม่ได้กรอก API / Density ช่วงบ่าย, e-DR ถึงกัปตัน / ตัวแทนสายการบิน, ปริมาณ Batch ถึง Thappline, ผลการอนุมัติ'],
      ['13.2', 'M', 4, 'Print Form / PDF (4 แบบ): Invoice A4, e-DR, Price Advice, Statement และหนังสือนำส่งศุลกากร (แก้ชื่อผู้ลงนามได้)'],
    ],
  },
  {
    name: '5. Out-Out (H018)',
    items: [
      ['1.2', 'H', 2, 'Out-Out (2 หน้า): Upload Invoice ของ Vendor → AI อ่านข้อมูล → ตรวจสอบ → Save และหน้ารวม Post (Post to SAP / Invoice / Reverse / Refresh Price / Export Excel)'],
      ['1.1', 'H', 1, 'Out-Out: บันทึกราคาฝั่งซื้อ-ขายในระบบ PASS และแสดง Margin แบบ real-time ก่อน Post Invoice'],
      ['1.1', 'M', 1, 'Price Advice: หน้า config ใบแจ้งราคารายลูกค้า (วันที่ / อีเมลที่ส่ง)'],
      ['5.1', 'H', 1, 'เชื่อมต่อ AI OCR API อ่าน Invoice ของ Vendor (ไม่รวมงานพัฒนาโมเดลของทีม AI)'],
    ],
  },
  {
    name: '6. Master Data & Administration',
    items: [
      ['1.1', 'M', 11, 'Master Data (11 รายการ, หน้ารวม / สร้าง / แก้ไข): Cargo Airline, Care Of, Plant, Airport, Aircraft Type, Customer (1 IATA Code หลาย Ship-to), Country, Material, L86 Parameter, Price Master – Formula Price, Price Master – Out-Out Unit Price (SCO Cost)'],
      ['1.1', 'L', 1, 'SAP Contract Master for ปตท.: แสดง contract ที่ sync จาก SAP ปตท. + ปุ่ม Refresh'],
      ['1.1', 'M', 2, 'User Management (สร้าง / แก้ไข / reset password) และ Business Unit Management'],
      ['12.2', 'H', 1, 'Role & Permission: แยกสิทธิ์ ขย. / พต. / สอ. / Approver / Admin / ลูกค้า และ 1 user เห็นข้อมูลได้หลาย Plant'],
      ['12.1', 'M', 3, 'Login (3 แบบ): AD-OR ผ่าน LDAP, AD-PTTPLC, user ใน DB สำหรับ Admin / ลูกค้า (password policy, expire, reset ทางอีเมล)'],
      ['12.4', 'M', 1, 'Session Policy: 1 account login ได้ 1 เครื่อง, เตะ session เก่าออก, Lock Login'],
      ['12.3', 'H', 1, 'Audit / History Log: บันทึก Login, บันทึก / แก้ไขข้อมูล, Post SAP, อนุมัติ และหน้าดู Log 15 หน้า'],
      ['14.2', 'M', 1, 'E-mail Log'],
      ['13.3', 'M', 1, 'E-mail Template Management (อีเมลแจ้ง สอ.)'],
      ['1.1', 'L', 2, 'E-mail Mapping (SMTP) และ Synchronize Management'],
    ],
  },
  {
    name: '7. System Interface',
    items: [
      ['5.3', 'H', 4, 'SAP RFC / BAPI (4 interface): Into-Plane Post to SAP (SO, DO, GI, Billing + รับสถานะกลับ), Out-Out ซื้อ-ขายในคำสั่งเดียว (PO, GR, LIV, FI, SO, DO, GI, INV), First / Second List → SO YOAE และ sync Formula Price, งานขายให้ ปตท. ผ่าน SAP ปตท.'],
      ['5.3', 'M', 2, 'SAP RFC (2 interface): ตรวจวงเงินลูกค้า, ดู / สั่งพิมพ์สำเนา SO, DR, Invoice จาก SAP'],
      ['5.2', 'M', 1, 'PIS ผ่าน WSO2: โครงสร้างองค์กร สายอนุมัติ และ Delegate'],
      ['5.2', 'L', 3, 'Sync Master Data จาก SAP (3 รายการ): Customer, Material, SAP Contract ปตท.'],
      ['5.1', 'H', 1, 'Thappline: รับปริมาณจาก Transfer Note แล้วส่งการรับน้ำมันเข้า plant DMK / BKK ใน SAP อัตโนมัติ'],
      ['5.1', 'L', 8, 'Tablet (PASS Mobile บน Windows) ให้ใช้งานได้เหมือนเดิม: ย้ายไปใช้ Backend REST API เดียวกับ Web และ remap DB ใหม่ (8 กลุ่ม API: Login, Download Master, First / Second List, DR Template, Create / Sync DR, L86, ดึงปริมาณเติมอัตโนมัติ, ส่ง e-DR)'],
      ['4', 'M', 4, 'Background Job (4 job): แจ้งเตือน First / Second List ใกล้หมดอายุ, ส่ง Uplift Report ถึงลูกค้าตามรอบเก็บเงิน, Sync Master Data จาก SAP / PIS, ดึง Transfer Note ของ Thappline'],
    ],
  },
  {
    name: '8. Report',
    items: [
      ['3', 'M', 7, 'รายงานที่ปรับปรุง / เพิ่มใหม่ (7 รายงาน): Uplift Report (ราคา, Out-Out, Blended SAF), Daily Report by DR, Airport Concession Fee Payment, Sales District Monthly Uplift (Reseller), รายงานเติมไปต่างประเทศที่ DMK, รายงานซื้อ-ขาย Out-Out H018, รายงานแยกรถ Dispenser / Refueller และแยก / รวม Cargo ที่ BKK'],
      ['3', 'L', 18, 'รายงานเดิมที่ย้ายมาระบบใหม่ (18 จาก 25 รายงาน)'],
      ['1.6', 'M', 3, 'Export Engine กลาง (3 รูปแบบ): Excel, Word, PDF รองรับรูปภาพประกอบ'],
    ],
  },
  {
    name: '9. Data Migration, Testing & Security',
    items: [
      ['6', 'M', 8, 'Data Migration จาก PASS เดิม (schema เดิม, ย้ายข้อมูลทั้งหมดเพื่อดูย้อนหลัง) — ประมาณ 8 กลุ่มตาราง รอนับจำนวนตารางจริง'],
      ['11.1', 'H', 2, 'Test Scenario & Test Script โมดูลใหม่ (2 โมดูล): การขายใหม่, Out-Out'],
      ['11.1', 'M', 4, 'Test Scenario & Test Script โมดูลเดิม (4 โมดูล): Into-Plane, Master Data, Report, User / Role / E-mail / Log'],
      ['11.3', 'H', 2, 'SIT โมดูลใหม่ (2 โมดูล) ร่วมกับ SAP OR / ปตท., AI OCR'],
      ['11.3', 'M', 4, 'SIT โมดูลเดิม (4 โมดูล) ร่วมกับ SAP, Thappline, AD, WSO2 / PIS, Tablet'],
      ['11.4', 'H', 2, 'UAT โมดูลใหม่ (2 โมดูล)', 'UAT Sign-off'],
      ['11.4', 'M', 4, 'UAT + Parallel Run โมดูลเดิม (4 โมดูล): กระทบยอดบัญชีกับระบบเดิมให้ตรงกัน 100%', 'UAT Sign-off'],
      ['7', 'H', 1, 'Fixed Security Scan: Source Code, Web, VA Scan ปิดช่องโหว่ทั้งหมดก่อน Go-live'],
    ],
  },
  {
    name: '10. Training & Go-Live',
    items: [
      ['15.1', 'H', 1, 'คู่มือและเอกสารอบรม User (ขย. / สอ. / พต. / ปตท.) และ Admin', 'Manual ×2, PPT ×2'],
      ['17.4', 'H', 1, 'Production Environment Setup'],
      ['17.5', 'H', 1, 'Final Prep (CRQ / ServiceNow / CAB), Cutover, Go-live และ Support หลัง Go-live 1 เดือน', 'Go-live Sign-off'],
      ['18.2', 'M', 13, 'ประชุมติดตามความคืบหน้าราย 2 สัปดาห์ตลอด 6 เดือน (13 ครั้ง)'],
    ],
  },
]

/** Same rounding as src/lib/estimate.ts. */
const round2 = (n) => Math.round(n * 100) / 100
const round4 = (n) => Math.round(n * 10000) / 10000

const db = new Database(file)
db.pragma('foreign_keys = ON')

const one = (sql, ...args) => db.prepare(sql).get(...args)
const all = (sql, ...args) => db.prepare(sql).all(...args)

/* ------------------------------------------------------- master lookups */

const activityByCode = new Map(
  all('SELECT id, code, count_unit AS countUnit FROM activities').map((a) => [a.code, a]),
)
const roles = all(
  `SELECT id, code, stack_multiplied AS stackMultiplied, rate_per_md AS ratePerMd,
          sort_order AS sortOrder
     FROM roles WHERE active = 1 ORDER BY sort_order, id`,
)
const cell = new Map(
  all('SELECT activity_id, role_id, complexity, manday FROM matrix_cells').map((c) => [
    `${c.activity_id}:${c.role_id}:${c.complexity}`,
    c.manday,
  ]),
)

const stack = one('SELECT id, multiplier FROM tech_stacks WHERE name = ?', PROJECT.techStack)
if (!stack) throw new Error(`tech stack not found: ${PROJECT.techStack}`)
const modifiers = PROJECT.modifiers.map((name) => {
  const m = one('SELECT id, multiplier FROM stack_modifiers WHERE name = ?', name)
  if (!m) throw new Error(`stack modifier not found: ${name}`)
  return m
})
const questionnaire = one('SELECT id FROM questionnaires WHERE name = ?', PROJECT.questionnaire)
const owner =
  one("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1") ??
  one('SELECT id FROM users ORDER BY id LIMIT 1')
if (!owner) throw new Error('no user to own the project; run "node scripts/seed.cjs" first')

const multiplier = round4(modifiers.reduce((acc, m) => acc * m.multiplier, stack.multiplier))

/* ------------------------------------------------------------- the plan */

const plan = PHASES.map((phase) => ({
  name: phase.name,
  items: phase.items.map(([code, complexity, qty, detail, deliverables]) => {
    const activity = activityByCode.get(code)
    if (!activity) throw new Error(`activity not found: ${code}`)
    return {
      code,
      activityId: activity.id,
      complexity,
      // A row counted once per project must not be multiplied.
      qty: activity.countUnit === ONCE_PER_PROJECT_UNIT ? 1 : qty,
      detail,
      deliverables: deliverables ?? null,
    }
  }),
}))

/** What the project should hold, comparable with what it already holds. */
const planKey = JSON.stringify(
  plan.flatMap((p) => p.items.map((i) => [p.name, i.code, i.complexity, i.qty, i.detail])),
)

function currentKey(projectId) {
  return JSON.stringify(
    all(
      `SELECT ph.name, a.code, i.complexity, i.qty, i.detail
         FROM project_items i
         JOIN project_phases ph ON ph.id = i.phase_id
         LEFT JOIN activities a ON a.id = i.activity_id
        WHERE i.project_id = ?
        ORDER BY ph.sort_order, i.sort_order, i.id`,
      projectId,
    ).map((r) => [r.name, r.code, r.complexity, r.qty, r.detail]),
  )
}

function editedOnWeb(project) {
  if (project.updated_at !== project.created_at) return true
  const { n } = one(
    `SELECT count(*) AS n FROM project_item_mandays m
       JOIN project_items i ON i.id = m.item_id
      WHERE i.project_id = ? AND m.overridden = 1`,
    project.id,
  )
  return n > 0
}

/* ---------------------------------------------------------------- write */

const insertProject = db.prepare(`
  INSERT INTO projects
    (code, name, duration_days, tech_stack_id, questionnaire_id, status,
     buffer_percent, wizard_step, owner_id)
  VALUES (?, ?, ?, ?, ?, 'draft', ?, 5, ?)`)
const insertModifier = db.prepare(
  'INSERT INTO project_modifiers (project_id, modifier_id) VALUES (?, ?)',
)
const insertPhase = db.prepare(
  'INSERT INTO project_phases (project_id, name, sort_order) VALUES (?, ?, ?)',
)
const insertItem = db.prepare(`
  INSERT INTO project_items
    (project_id, phase_id, activity_id, detail, complexity, qty, deliverables, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
const insertManday = db.prepare(
  'INSERT INTO project_item_mandays (item_id, role_id, manday, overridden) VALUES (?, ?, ?, 0)',
)
const insertRole = db.prepare(`
  INSERT INTO project_roles (project_id, role_id, rate_per_md, included, sort_order)
  VALUES (?, ?, ?, ?, ?)`)

const run = db.transaction((existing) => {
  for (const p of existing) db.prepare('DELETE FROM projects WHERE id = ?').run(p.id)

  const projectId = insertProject.run(
    PROJECT.code,
    PROJECT.name,
    PROJECT.durationDays,
    stack.id,
    questionnaire?.id ?? null,
    PROJECT.bufferPercent,
    owner.id,
  ).lastInsertRowid
  for (const m of modifiers) insertModifier.run(projectId, m.id)

  // MD(item, role) = matrix x qty x multiplier (stack-sensitive roles only),
  // the same formula as mandaysForItem in src/lib/actions/project.ts.
  const totals = new Map()
  plan.forEach((phase, p) => {
    const phaseId = insertPhase.run(projectId, phase.name, (p + 1) * 10).lastInsertRowid
    phase.items.forEach((item, i) => {
      const itemId = insertItem.run(
        projectId,
        phaseId,
        item.activityId,
        item.detail,
        item.complexity,
        item.qty,
        item.deliverables,
        (i + 1) * 10,
      ).lastInsertRowid
      for (const role of roles) {
        const base = cell.get(`${item.activityId}:${role.id}:${item.complexity}`) ?? 0
        const md = round2(base * item.qty * (role.stackMultiplied ? multiplier : 1))
        insertManday.run(itemId, role.id, md)
        totals.set(role.code, (totals.get(role.code) ?? 0) + md)
      }
    })
  })

  // Cost only the roles this estimate actually uses.
  for (const role of roles) {
    const included = (totals.get(role.code) ?? 0) > 0 ? 1 : 0
    insertRole.run(projectId, role.id, role.ratePerMd, included, role.sortOrder)
  }
  return { projectId, totals }
})

const existing = all(
  'SELECT id, created_at, updated_at FROM projects WHERE code = ? OR name = ?',
  PROJECT.code,
  PROJECT.name,
)

if (!force && existing.some(editedOnWeb)) {
  console.log(`New PASS: edited on the web, left as is (use --force to replace)`)
} else if (!force && existing.length === 1 && currentKey(existing[0].id) === planKey) {
  console.log(`New PASS: up to date (project ${existing[0].id})`)
} else {
  const { projectId, totals } = run(existing)
  const used = [...totals].filter(([, md]) => md > 0)
  const sum = round2(used.reduce((s, [, md]) => s + md, 0))
  console.log(
    `New PASS: ${existing.length ? 'replaced' : 'created'} project ${projectId}, ` +
      `${plan.reduce((n, p) => n + p.items.length, 0)} items, ${sum} MD ` +
      `(${used.map(([code, md]) => `${code} ${round2(md)}`).join(', ')})`,
  )
}

db.close()
