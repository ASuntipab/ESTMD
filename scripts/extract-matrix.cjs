/**
 * Reads MD_Standard_Matrix_v3.xlsx and writes src/lib/db/standard-matrix.json,
 * the seed data for the standard matrix. Re-run after the master file changes:
 *   npm run matrix:extract
 *
 * The spreadsheet is the source of truth. Rows are located by their header
 * labels rather than fixed row numbers, so inserting or reordering rows in
 * Excel does not break this script.
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const os = require('node:os')

const ROOT = path.resolve(__dirname, '..')
const XLSX = path.join(ROOT, 'MD_Standard_Matrix_v3.xlsx')

if (!fs.existsSync(XLSX)) {
  throw new Error(`master file not found: ${XLSX}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdmatrix-'))
// An .xlsx is a zip, but Expand-Archive only accepts the .zip extension.
const asZip = path.join(tmp, 'book.zip')
fs.copyFileSync(XLSX, asZip)
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Expand-Archive -LiteralPath '${asZip}' -DestinationPath '${tmp}' -Force`,
])

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Shared strings, used when a sheet does not store its text inline. */
const strings = (() => {
  const file = path.join(tmp, 'xl', 'sharedStrings.xml')
  if (!fs.existsSync(file)) return []
  const xml = fs.readFileSync(file, 'utf8')
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''),
  )
})()

/** Reads one worksheet into { at, num, lastRow, findRow }. */
function readSheet(file) {
  const xml = fs.readFileSync(
    path.join(tmp, 'xl', 'worksheets', file),
    'utf8',
  )

  const cells = new Map()
  for (const row of xml.matchAll(
    /<row[^>]*r="(\d+)"[^>]*(?:\/>|>([\s\S]*?)<\/row>)/g,
  )) {
    for (const c of (row[2] ?? '').matchAll(
      /<c r="([A-Z]+\d+)"((?:(?!\/>|>)[\s\S])*)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const attrs = c[2]
      const inner = c[3] ?? ''
      const type = /t="([^"]+)"/.exec(attrs)
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)

      let raw
      if (inline) raw = inline[1]
      else if (type && type[1] === 's' && value) raw = strings[+value[1]]
      else if (value) raw = value[1]

      if (raw !== undefined && raw !== '') cells.set(c[1], decode(raw).trim())
    }
  }

  const at = (col, row) => cells.get(`${col}${row}`) ?? ''
  const num = (col, row) => {
    const v = at(col, row)
    return v === '' ? 0 : Number(v)
  }
  const lastRow = Math.max(
    0,
    ...[...cells.keys()].map((a) => Number(/\d+$/.exec(a)[0])),
  )
  const findRow = (col, text, from = 1) => {
    for (let r = from; r <= lastRow; r++) {
      if (at(col, r).startsWith(text)) return r
    }
    throw new Error(
      `${file}: no row where column ${col} starts with "${text}"`,
    )
  }

  return { at, num, lastRow, findRow }
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .concat(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      .split('')
      .flatMap((a) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((b) => a + b)),
  )
const colAt = (index) => COLUMNS[index]

/* ============================================ sheet 2: the role definitions */

const roleSheet = readSheet('sheet2.xml')
const ROLE_HEADER = roleSheet.findRow('A', 'รหัส')

const roleDefs = []
for (let r = ROLE_HEADER + 1; r <= roleSheet.lastRow; r++) {
  const code = roleSheet.at('A', r)
  const name = roleSheet.at('B', r)
  if (!code || !name) continue
  // The buffer block sits below the table and has no rate.
  const rate = roleSheet.num('D', r)
  if (!rate) continue

  const ratio = roleSheet.at('G', r)
  roleDefs.push({
    code,
    name,
    seniority: roleSheet.at('C', r) === 'Senior' ? 'senior' : 'junior',
    ratePerMd: rate,
    stackMultiplied: roleSheet.at('E', r) === 'ใช่',
    scope: roleSheet.at('F', r) === 'phase' ? 'phase' : 'item',
    ratioOfDev: ratio === '' ? null : Number(ratio),
    hasMatrixColumn: roleSheet.at('H', r) === 'มี',
    sortOrder: (roleDefs.length + 1) * 10,
  })
}

const roleByName = new Map(roleDefs.map((r) => [r.name, r]))

/** Default buffer percentage, from the block under the role table. */
const bufferRow = roleSheet.findRow('A', 'ค่าเริ่มต้น (%)', ROLE_HEADER)
const defaultBufferPercent = Math.round(roleSheet.num('B', bufferRow) * 1000) / 10

/* ================================================== sheet 1: the MD matrix */

const sheet = readSheet('sheet1.xml')
const { at, num } = sheet

const HEADER = sheet.findRow('A', '#')
const LEVELS = HEADER + 1
const FIRST_DATA = LEVELS + 1

/** Role blocks are three columns wide, starting at each "L" of the level row. */
const roleColumns = []
for (let i = 0; i < COLUMNS.length - 2; i++) {
  const col = colAt(i)
  if (at(col, LEVELS) !== 'L') continue
  const name = at(col, HEADER)
  if (!name) continue
  const def = roleByName.get(name)
  if (!def) {
    throw new Error(
      `matrix column "${name}" is not listed on the ตารางบทบาท sheet`,
    )
  }
  roleColumns.push({ ...def, cols: [col, colAt(i + 1), colAt(i + 2)] })
}

const NOTE_COL = colAt(COLUMNS.indexOf(roleColumns.at(-1).cols[2]) + 1)
const COUNT_UNIT_COL = 'C'
const UNIT_COL = 'D'

const LEGEND_ROW = sheet.findRow('A', 'คำอธิบายระดับความซับซ้อน', FIRST_DATA)

const activities = []
let group = null
let sortOrder = 0

for (let r = FIRST_DATA; r < LEGEND_ROW; r++) {
  const code = at('A', r)
  const topic = at('B', r)
  const unit = at(UNIT_COL, r)

  // A group heading spans the row: a label in column A and no unit.
  if (!unit) {
    if (code) group = code.replace(/^\d+\.\s*/, '').trim()
    continue
  }
  if (!code) continue

  const indented = /^\s*-/.test(topic) || topic.startsWith('     ')
  const name = topic.replace(/^[\s-]+/, '').trim()

  activities.push({
    code,
    groupName: indented ? group : null,
    name,
    unit,
    countUnit: at(COUNT_UNIT_COL, r),
    notes: at(NOTE_COL, r) || null,
    sortOrder: (sortOrder += 10),
    cells: roleColumns.flatMap((role) =>
      ['L', 'M', 'H'].map((complexity, i) => ({
        role: role.code,
        complexity,
        manday: num(role.cols[i], r),
      })),
    ),
  })
}

/* ----------------------------------------------------- legends and multipliers */

const STACK_ROW = sheet.findRow('A', 'ตาราง Technology Stack', LEGEND_ROW)
const MODIFIER_ROW = sheet.findRow('A', 'ตารางตัวปรับ', STACK_ROW)

const complexityLegend = []
for (let r = LEGEND_ROW + 1; r < STACK_ROW; r++) {
  const label = at('B', r)
  if (!label) continue
  complexityLegend.push({ label, description: at(COUNT_UNIT_COL, r) })
}

/** Reads a multiplier table: name in B, multiplier in C, note in D. */
function readMultipliers(sectionRow, endRow) {
  const rows = []
  let order = 0
  for (let r = sectionRow + 1; r < endRow; r++) {
    const name = at('B', r)
    const multiplier = at(COUNT_UNIT_COL, r)
    // Skip the table's own header row, which has a non-numeric multiplier.
    if (!name || multiplier === '' || Number.isNaN(Number(multiplier))) continue
    rows.push({
      name,
      multiplier: Number(multiplier),
      note: at(UNIT_COL, r) || null,
      sortOrder: (order += 10),
    })
  }
  return rows
}

const techStacks = readMultipliers(STACK_ROW, MODIFIER_ROW)
const modifiers = readMultipliers(MODIFIER_ROW, sheet.lastRow + 1)

/* -------------------------------------------------------------------- output */

const version = /v(\d+\.\d+)/.exec(at('A', 1))

const out = {
  source: path.basename(XLSX),
  version: version ? version[1] : null,
  title: at('A', 1),
  defaultBufferPercent,
  roles: roleDefs.map(({ hasMatrixColumn, ...role }) => ({
    ...role,
    hasMatrixColumn,
  })),
  countUnits: [...new Set(activities.map((a) => a.countUnit))].filter(Boolean),
  complexityLegend,
  activities,
  techStacks,
  modifiers,
}

if (!roleDefs.length) throw new Error('no role rows were found')
if (!activities.length) throw new Error('no activity rows were found')
if (!techStacks.length) throw new Error('no technology stack rows were found')

const dest = path.join(ROOT, 'src', 'lib', 'db', 'standard-matrix.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')
fs.rmSync(tmp, { recursive: true, force: true })

console.log(
  `wrote ${path.relative(ROOT, dest)}: ${activities.length} activities, ` +
    `${roleDefs.length} roles (${roleColumns.length} with matrix columns), ` +
    `${techStacks.length} stacks, ${modifiers.length} modifiers, ` +
    `${out.countUnits.length} count units, buffer ${defaultBufferPercent}%`,
)
