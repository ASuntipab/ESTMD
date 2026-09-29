/**
 * Generates MD_Standard_Matrix_v3.xlsx. Run once per matrix version; after that
 * the spreadsheet is the source of truth and `npm run matrix:extract` reads it
 * back into standard-matrix.json.
 *
 *   npm run matrix:build
 *
 * Round-2 changes against v2 (see README for round 1):
 *   1. role columns added for PM / Infra / Azure / DevOps, so the phases that
 *      v2 could not express have somewhere to put their man-days
 *   2. 19 topics added, taken from the actuals in
 *      "PTT-PSM Platform_Manday_Estimate.xlsx" (610 MD): modernisation,
 *      DevOps / environment, project management, and four gaps in existing
 *      groups
 *   3. new "ตารางบทบาท" sheet carrying each role's seniority, day rate,
 *      estimating scope and target ratio of Developer man-days
 *   4. new count units: ต่อครั้ง / ต่อ stack / ต่อ database / ต่อ pipeline /
 *      ต่อ entity
 *
 * Existing rows keep their code, name and man-day values untouched.
 */
const path = require('node:path')
const ExcelJS = require('exceljs')

const OUT = path.resolve(__dirname, '..', 'MD_Standard_Matrix_v3.xlsx')
const VERSION = 'v3.0'
const EFFECTIVE = '2026-09-27'

const PSM = 'PTT-PSM Platform_Manday_Estimate.xlsx'

/**
 * Role columns of the matrix, in order. `seniority` and `ratePerMd` follow the
 * rate table of the PSM estimate: Senior 14,000 / Junior 8,500 / ABAPer 7,500.
 *
 * `scope`:
 *   item  — man-days come from this sheet, once per keyed line item
 *   phase — man-days are derived from `ratioOfDev` against the phase total
 * `ratioOfDev` is the target share of Developer man-days from the methodology
 * note of the PSM estimate. For item-scoped roles it is only a cross-check.
 */
const ROLES = [
  { code: 'PM', name: 'PM', seniority: 'senior', rate: 14000, stack: false, scope: 'item', ratio: 0.15, column: true },
  { code: 'SA', name: 'SA', seniority: 'senior', rate: 8500, stack: false, scope: 'item', ratio: 0.3, column: true },
  { code: 'BA', name: 'BA', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: 0.225, column: true },
  { code: 'DEV_SR', name: 'Developer (Senior)', seniority: 'senior', rate: 14000, stack: true, scope: 'item', ratio: null, column: true },
  { code: 'DEV', name: 'Developer', seniority: 'junior', rate: 8500, stack: true, scope: 'item', ratio: null, column: true },
  { code: 'TESTER', name: 'Tester', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: 0.35, column: true },
  { code: 'INFRA', name: 'Infra', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: true },
  { code: 'AZURE', name: 'Azure', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: true },
  { code: 'DEVOPS', name: 'DevOps', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: true },
  // Specialist roles that carry no matrix values yet: they are costed per
  // project when the feature needs them.
  { code: 'SECURITY', name: 'Security', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'PI', name: 'PI (WSO2)', seniority: 'senior', rate: 14000, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'DB', name: 'DB', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'DATA_LAKE', name: 'Data Lake', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'SAP_CONSULT', name: 'SAP Consult', seniority: 'senior', rate: 14000, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'SAP_MASTER', name: 'SAP Master', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'PIS', name: 'PIS', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'PTT_ZEUS', name: 'PTT_ZEUS', seniority: 'senior', rate: 14000, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'ABAPER', name: 'ABAPer', seniority: 'junior', rate: 7500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'SERVER', name: 'Server', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
  { code: 'TC', name: 'TC', seniority: 'junior', rate: 8500, stack: false, scope: 'item', ratio: null, column: false },
]

const COLUMN_ROLES = ROLES.filter((r) => r.column)

const UNITS = {
  PROJECT: 'ต่อโครงการ',
  MODULE: 'ต่อโมดูล',
  SCREEN: 'ต่อหน้าจอ',
  REPORT: 'ต่อรายงาน',
  DASHBOARD: 'ต่อ dashboard',
  JOB: 'ต่อ job',
  INTERFACE: 'ต่อ interface',
  WORKFLOW: 'ต่อ workflow',
  EVENT: 'ต่อเหตุการณ์',
  FILE_FORMAT: 'ต่อรูปแบบไฟล์',
  FORM: 'ต่อแบบฟอร์ม',
  TABLE: 'ต่อตาราง',
  ENVIRONMENT: 'ต่อ environment',
  OCCURRENCE: 'ต่อครั้ง',
  STACK: 'ต่อ stack',
  DATABASE: 'ต่อ database',
  PIPELINE: 'ต่อ pipeline',
  ENTITY: 'ต่อ entity',
}

/**
 * Man-day values keyed by role code. Existing rows are [L, M, H] per role,
 * exactly as v1/v2 had them. Rows sourced from the PSM estimate carry one
 * actual, so `flat` repeats it across the three levels rather than inventing
 * a spread.
 */
const flat = (n) => [n, n, n]

const V2 = {
  '1.1': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV_SR: [0, 0, 0], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '1.2': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV_SR: [0, 0, 0], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '1.3': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV_SR: [0, 0, 0], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '1.4': { SA: [1, 1, 2], BA: [0.5, 1, 1], DEV_SR: [1, 2, 3], DEV: [2, 3, 5], TESTER: [1, 2, 3] },
  '1.5': { SA: [0.5, 0.5, 1], BA: [0, 0.5, 0.5], DEV_SR: [0, 0, 1], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '1.6': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV_SR: [0, 0, 0], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '2': { SA: [1, 1.5, 2], BA: [0.5, 1, 1.5], DEV_SR: [0.5, 1, 2], DEV: [3, 5, 10], TESTER: [1, 2, 3] },
  '3': { SA: [0.5, 1, 1.5], BA: [0.5, 1, 1.5], DEV_SR: [0, 0.5, 1], DEV: [2, 4, 8], TESTER: [1, 1.5, 2.5] },
  '4': { SA: [0.5, 1, 1.5], BA: [0, 0.5, 1], DEV_SR: [0.5, 1, 2], DEV: [3, 5, 8], TESTER: [1, 1.5, 2.5] },
  '5.1': { SA: [1, 1.5, 2], BA: [0.5, 1, 1], DEV_SR: [1, 1.5, 2], DEV: [2, 3, 5], TESTER: [1, 1.5, 2] },
  '5.2': { SA: [1, 1.5, 2], BA: [0.5, 1, 1], DEV_SR: [1, 1.5, 2], DEV: [2, 3, 5], TESTER: [1, 1.5, 2] },
  '5.3': { SA: [1, 1.5, 2], BA: [0.5, 1, 1], DEV_SR: [1, 1.5, 2], DEV: [2, 3, 5], TESTER: [1, 1.5, 2] },
  '6': { SA: [1, 2, 3], BA: [0.5, 1, 1.5], DEV_SR: [1, 2, 3], DEV: [2, 5, 10], TESTER: [1, 2, 3] },
  '7': { SA: [0, 0, 0.5], BA: [0, 0, 0], DEV_SR: [1, 2, 3], DEV: [2, 4, 6], TESTER: [2, 3, 5] },
  '8': { SA: [0.5, 0.5, 1], BA: [0, 0, 0], DEV_SR: [0.5, 1, 1], DEV: [1, 2, 3], TESTER: [0.5, 0.5, 1] },
  '9': { SA: [1, 1.5, 2], BA: [0, 0, 0], DEV_SR: [2, 3, 4], DEV: [5, 7, 10], TESTER: [0.5, 1, 1] },
  '10.1': { SA: [0.5, 1, 2], BA: [1, 2, 4] },
  '10.2': { SA: [1, 2, 3], BA: [1, 3, 5] },
  '10.3': { SA: [1, 3, 5], BA: [1, 3, 6], DEV: [0.5, 1, 2] },
  '10.4': { SA: [2, 5, 8], BA: [1, 2, 3] },
  '11.1': { TESTER: [1, 3, 5] },
  '11.3': { DEV: [0.5, 1, 1], TESTER: [1, 2, 3] },
  '11.4': { BA: [0.5, 1, 1], TESTER: [1, 2, 3] },
  '12.1': { SA: [1, 1.5, 2], BA: [0.5, 1, 1], DEV_SR: [1, 1.5, 2], DEV: [2, 3, 5], TESTER: [1, 1.5, 2] },
  '12.2': { SA: [1, 1, 2], BA: [0.5, 1, 1], DEV_SR: [1, 2, 3], DEV: [2, 3, 5], TESTER: [1, 2, 3] },
  '12.3': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '13.1': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '13.2': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '14.1': { SA: [0.5, 1, 1.5], BA: [0, 0.5, 1], DEV_SR: [0.5, 1, 2], DEV: [3, 5, 8], TESTER: [1, 1.5, 2.5] },
  '14.2': { SA: [0.5, 1, 1.5], BA: [0.5, 0.5, 1], DEV: [2, 3, 5], TESTER: [1, 1, 2] },
  '15.1': { BA: [2, 5, 8], TESTER: [1, 2, 3] },
}

/** Rows added in v3, with their man-days taken from the PSM estimate. */
const fromPsm = (rows, cells) => ({
  cells,
  note: `ค่าจาก actual ${PSM} (${rows}) — ยังไม่แยกระดับ L/M/H รอข้อมูลจากโครงการอื่น`,
})

const V3 = {
  '12.4': fromPsm('R32-R33', {
    PM: flat(2),
    SA: flat(4),
    DEV: flat(3),
    TESTER: flat(2),
  }),
  '13.3': fromPsm('R37', { DEV: flat(5) }),
  '14.3': fromPsm('R39-R40', {
    PM: flat(2),
    SA: flat(7),
    DEV: flat(8),
    TESTER: flat(5),
  }),
  '16.1': fromPsm('R17', { DEV_SR: flat(1), DEV: flat(8) }),
  '16.2': fromPsm('R18', { DEV: flat(1) }),
  '16.3': fromPsm('R19', { DEV: flat(2), INFRA: flat(6) }),
  '16.4': fromPsm('R20', { PM: flat(2), INFRA: flat(6), AZURE: flat(12) }),
  '16.5': fromPsm('R81-R82', { DEV: flat(5) }),
  '16.6': fromPsm('R100', { DEV: flat(3) }),
  '17.1': fromPsm('R21', { PM: flat(3), DEV: flat(1), DEVOPS: flat(12) }),
  '17.2': fromPsm('R22', { PM: flat(5), DEV_SR: flat(3), DEV: flat(28) }),
  '17.3': fromPsm('R27', { PM: flat(3), INFRA: flat(3) }),
  '17.4': fromPsm('R104', { PM: flat(2), DEV_SR: flat(1), INFRA: flat(4) }),
  '17.5': fromPsm('R105', {
    PM: flat(5),
    SA: flat(10),
    DEV_SR: flat(5),
    DEV: flat(10),
  }),
  '18.1': fromPsm('R8-R9', { PM: flat(3) }),
  '18.2': {
    cells: { PM: [0.15, 0.25, 0.5] },
    note: 'แปลงจากชั่วโมง: L = ประชุม 1 ชม. / M = 2 ชม. / H = 4 ชม. (8 ชม. = 1 MD) — ไฟล์ PSM ปัด 28 ชม. ขึ้นเป็น 5 MD',
  },
  '18.3': fromPsm('R5-R7', { PM: flat(6) }),
  '18.4': fromPsm('R12', { PM: flat(5) }),
  '18.5': fromPsm('R103', { PM: flat(5) }),
}

/** The sheet, in order. A `group` entry starts a heading row. */
const ROWS = [
  { group: '1. CRUD' },
  { code: '1.1', name: 'List / Search', unit: UNITS.SCREEN },
  { code: '1.2', name: 'Add', unit: UNITS.SCREEN },
  { code: '1.3', name: 'Edit', unit: UNITS.SCREEN },
  { code: '1.4', name: 'WorkFlow (multi-step / conditional approval)', unit: UNITS.WORKFLOW },
  { code: '1.5', name: 'Notification (email / in-app)', unit: UNITS.EVENT },
  { code: '1.6', name: 'Export (Excel / PDF)', unit: UNITS.FILE_FORMAT },

  { code: '2', name: 'Dashboard', unit: UNITS.DASHBOARD, standalone: true },
  { code: '3', name: 'Report', unit: UNITS.REPORT, standalone: true },
  { code: '4', name: 'Job / Schedule (background job)', unit: UNITS.JOB, standalone: true },

  { group: '5. Interface / Integration' },
  { code: '5.1', name: 'API Integration (RESTful)', unit: UNITS.INTERFACE },
  { code: '5.2', name: 'External Master Data Sync', unit: UNITS.INTERFACE },
  { code: '5.3', name: 'Legacy / RFC Integration', unit: UNITS.INTERFACE },

  { code: '6', name: 'Implement / Migration (Data Prepare)', unit: UNITS.TABLE, standalone: true },
  { code: '7', name: 'Fixed Security Scan (remediation)', unit: UNITS.PROJECT, standalone: true },
  { code: '8', name: 'Init Server (Test / Setup / Connect)', unit: UNITS.ENVIRONMENT, standalone: true },
  { code: '9', name: 'Init Project Structure', unit: UNITS.PROJECT, standalone: true },

  { group: '10. Requirement & Design' },
  { code: '10.1', name: 'Get Requirement', unit: UNITS.MODULE },
  { code: '10.2', name: 'Create Business Blueprint', unit: UNITS.MODULE },
  { code: '10.3', name: 'Design Mockup', unit: UNITS.SCREEN },
  { code: '10.4', name: 'Create Design Specification (TOR)', unit: UNITS.PROJECT },

  { group: '11. Testing' },
  { code: '11.1', name: 'Create Test Scenario & Test Script', unit: UNITS.MODULE },
  { code: '11.3', name: 'System Integration Test (SIT)', unit: UNITS.MODULE },
  { code: '11.4', name: 'User Acceptance Test (UAT)', unit: UNITS.MODULE },

  { group: '12. Security & Access' },
  {
    code: '12.1',
    name: 'Authentication / SSO (Azure AD / B2C / PTT CAA)',
    unit: UNITS.INTERFACE,
    note: 'ค่าตั้งต้นอ้างอิงจาก 5.1 API Integration — เป็นการต่อ identity provider รอ validate จาก actual',
  },
  {
    code: '12.2',
    name: 'Role & Permission Management (กลุ่มผู้ใช้ / สิทธิ์ตามเมนู)',
    unit: UNITS.PROJECT,
    note: 'ค่าตั้งต้นอ้างอิงจาก 1.4 WorkFlow — มีเมทริกซ์สิทธิ์และผลกระทบข้ามหน้าจอ รอ validate จาก actual',
  },
  {
    code: '12.3',
    name: 'Audit / History Log',
    unit: UNITS.PROJECT,
    note: 'ค่าตั้งต้นอ้างอิงจาก 1.1 List / Search — หน้าจอดู log บวก hook ตอนเขียน รอ validate จาก actual',
  },
  { code: '12.4', name: 'Session Timeout / Session Policy', unit: UNITS.PROJECT },

  { group: '13. Content & Document' },
  {
    code: '13.1',
    name: 'File Upload / Attachment',
    unit: UNITS.SCREEN,
    note: 'ค่าตั้งต้นอ้างอิงจาก 1.2 Add รอ validate จาก actual (ยังไม่รวม virus scan / storage แยก)',
  },
  {
    code: '13.2',
    name: 'Print Form / Document Layout',
    unit: UNITS.FORM,
    note: 'ค่าตั้งต้นอ้างอิงจาก 1.6 Export — งานจัด layout ฟอร์มพิมพ์ รอ validate จาก actual',
  },
  { code: '13.3', name: 'Email Template Management', unit: UNITS.PROJECT },

  { group: '14. Operations' },
  {
    code: '14.1',
    name: 'Data Retention / Archive',
    unit: UNITS.PROJECT,
    note: 'ค่าตั้งต้นอ้างอิงจาก 4 Job / Schedule — ทำงานเป็น batch ตามรอบ รอ validate จาก actual',
  },
  {
    code: '14.2',
    name: 'Email Log / Monitoring',
    unit: UNITS.PROJECT,
    note: 'ค่าตั้งต้นอ้างอิงจาก 1.1 List / Search รอ validate จาก actual',
  },
  { code: '14.3', name: 'Master Data Management (WorkType / Category)', unit: UNITS.ENTITY },

  { group: '15. Deployment & Training' },
  {
    code: '15.1',
    name: 'Prepare Training Material / User Manual',
    unit: UNITS.PROJECT,
    note: 'ย้ายมาจาก 11.2 ที่เคยอยู่ใต้กลุ่ม Testing โดยไม่แก้ค่า MD',
  },

  { group: '16. Modernisation & Upgrade' },
  { code: '16.1', name: 'Backend Framework / Runtime Upgrade', unit: UNITS.STACK },
  { code: '16.2', name: 'Frontend Framework Upgrade', unit: UNITS.STACK },
  { code: '16.3', name: 'Database Upgrade / Migration to PaaS', unit: UNITS.DATABASE },
  { code: '16.4', name: 'Cloud Migration (On-Premise → Cloud)', unit: UNITS.PROJECT },
  { code: '16.5', name: 'Digitize Paper Form', unit: UNITS.FORM },
  { code: '16.6', name: 'Email Service Migration (SMTP → MS-Graph)', unit: UNITS.PROJECT },

  { group: '17. DevOps & Environment' },
  { code: '17.1', name: 'CI/CD Pipeline Setup', unit: UNITS.PIPELINE },
  { code: '17.2', name: 'DevSecOps Rule / Policy', unit: UNITS.PROJECT },
  { code: '17.3', name: 'Firewall / Network Request', unit: UNITS.INTERFACE },
  { code: '17.4', name: 'Production Environment Setup', unit: UNITS.ENVIRONMENT },
  { code: '17.5', name: 'Go-live Support & Sign-off', unit: UNITS.PROJECT },

  { group: '18. Project Management' },
  { code: '18.1', name: 'Kick-off & Project Plan', unit: UNITS.PROJECT },
  { code: '18.2', name: 'Recurring Meeting / Progress Report', unit: UNITS.OCCURRENCE },
  { code: '18.3', name: 'Business Development (Proposal / Impact Analysis)', unit: UNITS.PROJECT },
  { code: '18.4', name: 'EA Process', unit: UNITS.PROJECT },
  { code: '18.5', name: 'QA Process', unit: UNITS.PROJECT },
]

const COMPLEXITY_LEGEND = [
  {
    label: 'L (Low)',
    description:
      'CRUD / แสดงผล / ใช้เครื่องมือสำเร็จรูป — ไม่มี business rule พิเศษ ใช้ library/pattern ที่มีอยู่แล้วได้ทันที',
  },
  {
    label: 'M (Medium)',
    description:
      'workflow, business logic, การแจ้งเตือน — มี business rule 2-3 เงื่อนไข หรือต้องเชื่อมต่อระบบอื่น 1 ระบบ',
  },
  {
    label: 'H (High)',
    description:
      'เชื่อมต่อระบบภายนอก, อนุมัติหลายขั้น, security-critical — business rule ซับซ้อนหลายเงื่อนไขซ้อนกัน, หลาย state/role, หรือเชื่อมหลายระบบพร้อมกัน',
  },
]

const STACKS = [
  { name: 'ReactJS / AngularJS (ทีมคุ้นเคย)', multiplier: 1, note: 'Baseline - ทีมมีประสบการณ์ตรง' },
  { name: 'ASP.NET MVC / ASP.NET Core', multiplier: 1, note: 'Baseline - เฟรมเวิร์คมาตรฐาน องค์กรใช้ประจำ' },
  { name: 'Node.js Backend', multiplier: 1.05, note: 'Ecosystem เปลี่ยนเร็ว ต้องตรวจ dependency เพิ่ม' },
  { name: 'React Native / Mobile Hybrid', multiplier: 1.3, note: 'ต้อง handle platform-specific + build/release' },
]

const MODIFIERS = [
  { name: 'Responsive Web (เพิ่มจาก Desktop)', multiplier: 1.15, note: 'เพิ่ม breakpoint / QA หลายขนาดจอ' },
  { name: 'Stack ใหม่ที่ทีมไม่คุ้นเคย', multiplier: 1.4, note: 'รวม learning curve และความเสี่ยง rework' },
]

/* ------------------------------------------------------------------ styling */

const BRAND = 'FF00327B'
const HEAD_FILL = 'FFE7EEFB'
const GROUP_FILL = 'FFF4F6F8'
const NEW_FILL = 'FFFFF9E6'
const thin = { style: 'thin', color: { argb: 'FFBFCBD9' } }
const border = { top: thin, left: thin, bottom: thin, right: thin }

const COL_CODE = 1
const COL_TOPIC = 2
const COL_COUNT_UNIT = 3
const COL_UNIT = 4
const COL_FIRST_ROLE = 5
const COL_NOTE = COL_FIRST_ROLE + COLUMN_ROLES.length * 3

async function main() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PTT Digital'
  wb.created = new Date()

  /* ===================================================== sheet 1: the matrix */

  const ws = wb.addWorksheet('MD_Standard_Matrix', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 6 }],
  })

  ws.columns = [
    { width: 7 },
    { width: 46 },
    { width: 15 },
    { width: 7 },
    ...COLUMN_ROLES.flatMap(() => [{ width: 6 }, { width: 6 }, { width: 6 }]),
    { width: 66 },
  ]

  ws.getCell(1, 1).value =
    `MD Estimation Standard Matrix ${VERSION} — มาตรฐานการประเมิน Man-Day ตามบทบาท (Role) × ระดับความซับซ้อน (L/M/H)`
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: BRAND } }
  ws.mergeCells(1, 1, 1, COL_NOTE)

  ws.getCell(2, 1).value =
    'ใช้เป็นตารางอ้างอิงกลาง (generic) สำหรับประเมิน MD เบื้องต้นของทุกโครงการ Web/Mobile Application — เลือกแถว Topic ที่ตรงกับฟีเจอร์ แล้วเลือกค่า L (เรียบง่าย) / M (ปานกลาง) / H (ซับซ้อน) ตามความยากของฟีเจอร์นั้นในแต่ละบทบาท'
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' }
  ws.mergeCells(2, 1, 2, COL_NOTE)
  ws.getRow(2).height = 30

  ws.getCell(3, 1).value =
    `เวอร์ชัน ${VERSION} · มีผล ${EFFECTIVE} · คอลัมน์ "หน่วยนับ" บอกว่าค่า MD ในแถวนั้นคิดต่อหนึ่งอะไร — แถวที่เป็น "${UNITS.PROJECT}" ให้นับครั้งเดียวต่อโครงการ ห้ามคูณจำนวน · แถวพื้นสีเหลืองคือค่าที่ยืมมาหรือมาจาก actual โครงการเดียว ยังต้อง validate`
  ws.getCell(3, 1).font = { italic: true, size: 10 }
  ws.getCell(3, 1).alignment = { wrapText: true, vertical: 'top' }
  ws.mergeCells(3, 1, 3, COL_NOTE)
  ws.getRow(3).height = 30

  const HEADER_ROW = 5
  const head = ws.getRow(HEADER_ROW)
  const sub = ws.getRow(HEADER_ROW + 1)

  head.getCell(COL_CODE).value = '#'
  head.getCell(COL_TOPIC).value = 'Topic'
  head.getCell(COL_COUNT_UNIT).value = 'หน่วยนับ'
  head.getCell(COL_UNIT).value = 'หน่วย'
  head.getCell(COL_NOTE).value = 'หมายเหตุ / ที่มาของค่า'
  for (const col of [COL_CODE, COL_TOPIC, COL_COUNT_UNIT, COL_UNIT, COL_NOTE]) {
    ws.mergeCells(HEADER_ROW, col, HEADER_ROW + 1, col)
  }

  COLUMN_ROLES.forEach((role, i) => {
    const col = COL_FIRST_ROLE + i * 3
    head.getCell(col).value = role.name
    ws.mergeCells(HEADER_ROW, col, HEADER_ROW, col + 2)
    ;['L', 'M', 'H'].forEach((level, j) => {
      sub.getCell(col + j).value = level
    })
  })

  for (const row of [head, sub]) {
    for (let c = 1; c <= COL_NOTE; c++) {
      const cell = row.getCell(c)
      cell.font = { bold: true, size: row === head ? 10 : 9 }
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === COL_TOPIC || c === COL_NOTE ? 'left' : 'center',
        wrapText: true,
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
      cell.border = border
    }
  }
  head.height = 26

  let r = HEADER_ROW + 2
  for (const spec of ROWS) {
    const row = ws.getRow(r)

    if (spec.group) {
      row.getCell(COL_CODE).value = spec.group
      ws.mergeCells(r, COL_CODE, r, COL_NOTE)
      const cell = row.getCell(COL_CODE)
      cell.font = { bold: true, color: { argb: BRAND } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_FILL } }
      cell.border = border
      r++
      continue
    }

    const added = V3[spec.code]
    const cells = added ? added.cells : V2[spec.code]
    if (!cells) throw new Error(`no man-day values for ${spec.code}`)
    const note = spec.note ?? added?.note ?? ''

    row.getCell(COL_CODE).value = spec.code
    row.getCell(COL_TOPIC).value = spec.standalone ? spec.name : `     - ${spec.name}`
    row.getCell(COL_COUNT_UNIT).value = spec.unit
    row.getCell(COL_UNIT).value = 'MD'
    row.getCell(COL_NOTE).value = note

    COLUMN_ROLES.forEach((role, roleIndex) => {
      const levels = cells[role.code] ?? [0, 0, 0]
      levels.forEach((manday, levelIndex) => {
        const cell = row.getCell(COL_FIRST_ROLE + roleIndex * 3 + levelIndex)
        cell.value = manday
        cell.numFmt = '0.##'
      })
    })

    for (let c = 1; c <= COL_NOTE; c++) {
      const cell = row.getCell(c)
      cell.border = border
      cell.alignment = {
        vertical: 'top',
        horizontal: c === COL_TOPIC || c === COL_NOTE ? 'left' : 'center',
        wrapText: c === COL_TOPIC || c === COL_NOTE,
      }
      if (note) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEW_FILL } }
      }
    }
    r++
  }

  const section = (title) => {
    r++
    const row = ws.getRow(r)
    row.getCell(1).value = title
    ws.mergeCells(r, 1, r, COL_NOTE)
    row.getCell(1).font = { bold: true, color: { argb: BRAND } }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_FILL } }
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    r++
  }

  section('คำอธิบายระดับความซับซ้อน (Complexity Level)')
  for (const item of COMPLEXITY_LEGEND) {
    const row = ws.getRow(r)
    row.getCell(COL_TOPIC).value = item.label
    row.getCell(COL_COUNT_UNIT).value = item.description
    ws.mergeCells(r, COL_COUNT_UNIT, r, COL_NOTE)
    row.getCell(COL_COUNT_UNIT).alignment = { wrapText: true, vertical: 'top' }
    r++
  }

  const multiplierTable = (rows) => {
    const h = ws.getRow(r)
    h.getCell(COL_TOPIC).value = 'รายการ'
    h.getCell(COL_COUNT_UNIT).value = 'ตัวคูณ (× MD)'
    h.getCell(COL_UNIT).value = 'หมายเหตุ'
    ws.mergeCells(r, COL_UNIT, r, COL_NOTE)
    for (const c of [COL_TOPIC, COL_COUNT_UNIT, COL_UNIT]) {
      h.getCell(c).font = { bold: true, size: 10 }
    }
    r++
    for (const item of rows) {
      const row = ws.getRow(r)
      row.getCell(COL_TOPIC).value = item.name
      row.getCell(COL_COUNT_UNIT).value = item.multiplier
      row.getCell(COL_COUNT_UNIT).numFmt = '0.##'
      row.getCell(COL_COUNT_UNIT).alignment = { horizontal: 'center' }
      row.getCell(COL_UNIT).value = item.note
      ws.mergeCells(r, COL_UNIT, r, COL_NOTE)
      row.getCell(COL_UNIT).alignment = { wrapText: true, vertical: 'top' }
      r++
    }
  }

  section('ตาราง Technology Stack (เลือก 1 รายการ) — ใช้กับคอลัมน์ Developer และ Developer (Senior) เท่านั้น')
  multiplierTable(STACKS)

  section('ตารางตัวปรับ (เลือกได้หลายรายการ คูณทับกัน) — ใช้กับคอลัมน์ Developer และ Developer (Senior) เท่านั้น')
  multiplierTable(MODIFIERS)

  r++
  ws.getCell(r, 1).value =
    'สูตร: MD = ค่าในตาราง × จำนวนตามหน่วยนับ × ตัวคูณ Stack × ตัวปรับทุกตัวที่เลือก (คูณต่อเนื่อง) — ตัวคูณและตัวปรับไม่มีผลกับบทบาทอื่นนอกจาก Developer / Developer (Senior)'
  ws.mergeCells(r, 1, r, COL_NOTE)
  ws.getCell(r, 1).font = { italic: true, size: 10 }
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }

  /* ==================================================== sheet 2: role table */

  const rs = wb.addWorksheet('ตารางบทบาท')
  rs.columns = [
    { width: 16 },
    { width: 24 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
    { width: 56 },
  ]

  rs.getCell(1, 1).value = `ตารางบทบาท (Role) ${VERSION}`
  rs.getCell(1, 1).font = { bold: true, size: 13, color: { argb: BRAND } }
  rs.mergeCells(1, 1, 1, 8)

  rs.getCell(2, 1).value =
    'อัตราต่อวันอ้างอิงตาราง Rev/Day: Senior = 14,000 · Junior/Officer = 8,500 · ABAPer = 7,500 — "ขอบเขตการประเมิน" กำหนดว่า MD ของบทบาทนั้นมาจากเมทริกซ์รายบรรทัด (item) หรือคิดเป็นสัดส่วนของ Developer ต่อ phase (phase) — "สัดส่วนเป้าหมาย" มาจาก Estimation Note ของ PTT-PSM Platform ใช้เป็นตัวเทียบความสมเหตุสมผล'
  rs.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' }
  rs.mergeCells(2, 1, 2, 8)
  rs.getRow(2).height = 46

  const roleHead = rs.getRow(4)
  const roleHeaders = [
    'รหัส',
    'บทบาท',
    'ระดับ',
    'อัตรา/วัน (บาท)',
    'คูณตาม stack',
    'ขอบเขตการประเมิน',
    'สัดส่วนเป้าหมาย (ของ Dev)',
    'มีคอลัมน์ในเมทริกซ์',
  ]
  roleHeaders.forEach((label, i) => {
    const cell = roleHead.getCell(i + 1)
    cell.value = label
    cell.font = { bold: true, size: 10 }
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
    cell.border = border
  })
  roleHead.height = 30

  ROLES.forEach((role, i) => {
    const row = rs.getRow(5 + i)
    row.getCell(1).value = role.code
    row.getCell(2).value = role.name
    row.getCell(3).value = role.seniority === 'senior' ? 'Senior' : 'Junior'
    row.getCell(4).value = role.rate
    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).value = role.stack ? 'ใช่' : 'ไม่'
    row.getCell(6).value = role.scope
    row.getCell(7).value = role.ratio ?? ''
    if (role.ratio) row.getCell(7).numFmt = '0%'
    row.getCell(8).value = role.column ? 'มี' : 'ไม่มี'
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).border = border
      row.getCell(c).alignment = {
        horizontal: c === 2 ? 'left' : 'center',
        vertical: 'top',
      }
    }
  })

  const bufferRow = 5 + ROLES.length + 2
  rs.getCell(bufferRow, 1).value = 'Buffer / Contingency'
  rs.getCell(bufferRow, 1).font = { bold: true, color: { argb: BRAND } }
  rs.mergeCells(bufferRow, 1, bufferRow, 8)
  rs.getCell(bufferRow + 1, 1).value = 'ค่าเริ่มต้น (%)'
  rs.getCell(bufferRow + 1, 2).value = 0.1
  rs.getCell(bufferRow + 1, 2).numFmt = '0%'
  rs.getCell(bufferRow + 1, 3).value =
    'บวกท้ายยอดรวมทั้งโครงการ ตั้งค่าได้ต่อโครงการ — ไฟล์ PTT-PSM Platform ใช้ 18% แล้วปัดยอด จากนั้นบวก 10% อีกชั้น ซึ่งควรกำหนดกฎให้ชัดว่าใช้ชั้นเดียว'
  rs.mergeCells(bufferRow + 1, 3, bufferRow + 1, 8)
  rs.getCell(bufferRow + 1, 3).alignment = { wrapText: true, vertical: 'top' }

  await wb.xlsx.writeFile(OUT)

  const activities = ROWS.filter((x) => x.code)
  console.log(
    `wrote ${path.basename(OUT)}: ${activities.length} activities ` +
      `(${Object.keys(V3).length} new in v3), ${COLUMN_ROLES.length} role columns, ` +
      `${ROLES.length} roles, ${STACKS.length} stacks, ${MODIFIERS.length} modifiers`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
