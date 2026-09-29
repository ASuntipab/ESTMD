/**
 * Renders the export workbook for one project straight from the database and
 * prints the sheet, so the file can be checked without a browser download:
 *   npx tsx scripts/verify-export.ts 1 [out.xlsx]
 */
import 'dotenv/config'

import fs from 'node:fs'
import Module from 'node:module'
import ExcelJS from 'exceljs'

// The app modules guard themselves with `server-only`, which throws outside the
// Next.js bundler. Neutralise it so this script can reuse the real code path.
const require_ = Module.createRequire(import.meta.url)
require_.cache[require_.resolve('server-only')] = new Module.Module(
  'server-only',
) as never
Object.assign(require_.cache[require_.resolve('server-only')]!, {
  exports: {},
  loaded: true,
})

const projectId = Number(process.argv[2] ?? 1)
const outFile = process.argv[3]

async function main() {
  // The app modules are server-only; import them after dotenv is loaded.
  const { getProjectDetail } = await import('../src/lib/queries')
  const { buildSummary } = await import('../src/lib/summary')
  const { buildWorkbook } = await import('../src/lib/excel')

  const detail = await getProjectDetail(projectId)
  if (!detail) throw new Error(`project ${projectId} not found`)

  const wb = await buildWorkbook(buildSummary(detail))
  const buffer = await wb.xlsx.writeBuffer()

  if (outFile) {
    fs.writeFileSync(outFile, Buffer.from(buffer))
    console.log(`wrote ${outFile} (${Buffer.from(buffer).length} bytes)`)
  }

  // Read it back through a fresh workbook: proves the file actually parses.
  const check = new ExcelJS.Workbook()
  await check.xlsx.load(buffer)

  for (const ws of check.worksheets) {
    console.log(`\n=== SHEET "${ws.name}" (${ws.rowCount} rows)`)
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        let v: unknown = cell.value
        if (v && typeof v === 'object') {
          const o = v as { formula?: string; result?: unknown; richText?: { text: string }[] }
          if (o.richText) v = o.richText.map((t) => t.text).join('')
          else if (o.formula) v = `=${o.formula} [${o.result}]`
        }
        cells.push(`${cell.address}=${String(v).replace(/\n/g, ' / ').slice(0, 70)}`)
      })
      if (cells.length) console.log(`R${r}: ${cells.join(' | ')}`)
    })
    const merges = (ws.model as { merges?: string[] }).merges
    if (merges?.length) console.log(`MERGES: ${merges.join(', ')}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
