import 'server-only'

import ExcelJS from 'exceljs'

import { STANDARD } from './standard'
import type { Summary } from './summary'

/**
 * Builds the estimation workbook in the layout of PTT-PSSR-Online_Manday.xlsx
 * (sheet "PTTDigital_Manday"):
 *
 *   row 1        project name
 *   row 2        duration, then the resource level per role column (Of1 / Sr1)
 *   rows 3-4     header: Phase | Details | Due Date Plan | Deliverables | roles
 *   rows 5..n    one row per line item, grouped and merged by phase in col A
 *   total row    SUM() per role column
 *   rate row     rate per man-day
 *   cost row     manday x rate
 *   grand total  sum of the cost row
 *
 * Plus a "Questionnaire" sheet with the survey as answered (when the project
 * used one) and a "Basis of Estimate" sheet with the assumptions.
 */
const HEADERS = ['Phase', 'Details', 'Due Date Plan', 'Deliverables'] as const
const FIRST_ROLE_COL = HEADERS.length + 1 // column E
const BRAND = 'FF00327B'
const HEADER_FILL = 'FFE7EEFB'
const TOTAL_FILL = 'FFFFF3CD'

const thin = { style: 'thin' as const, color: { argb: 'FFBFCBD9' } }
const border = { top: thin, left: thin, bottom: thin, right: thin }

export async function buildWorkbook(summary: Summary) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Manday Estimation (PTT Digital)'
  wb.created = new Date()

  const ws = wb.addWorksheet('PTTDigital_Manday', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
  })

  const { roles } = summary
  const lastCol = HEADERS.length + Math.max(roles.length, 1)

  ws.columns = [
    { width: 18 },
    { width: 52 },
    { width: 14 },
    { width: 22 },
    ...roles.map(() => ({ width: 13 })),
  ]

  /* ------------------------------------------------------------ title rows */

  const title = ws.getRow(1)
  title.getCell(1).value = summary.project.code
    ? `โครงการ ${summary.project.name} (${summary.project.code})`
    : `โครงการ ${summary.project.name}`
  title.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } }
  ws.mergeCells(1, 1, 1, lastCol)
  title.height = 22

  const subtitle = ws.getRow(2)
  subtitle.getCell(1).value = `(ระยะเวลาโครงการ ${
    summary.project.durationDays ?? '…….'
  } วัน)`
  subtitle.getCell(1).font = { italic: true, size: 10 }
  ws.mergeCells(2, 1, 2, HEADERS.length)
  roles.forEach((role, i) => {
    const cell = subtitle.getCell(FIRST_ROLE_COL + i)
    cell.value = role.resourceLabel ?? ''
    cell.alignment = { horizontal: 'center' }
    cell.font = { size: 10 }
  })

  /* --------------------------------------------------------- header rows 3-4 */

  const head = ws.getRow(3)
  const sub = ws.getRow(4)
  head.height = 28

  HEADERS.forEach((label, i) => {
    head.getCell(i + 1).value = label
    ws.mergeCells(3, i + 1, 4, i + 1)
  })
  roles.forEach((role, i) => {
    head.getCell(FIRST_ROLE_COL + i).value = role.name
    sub.getCell(FIRST_ROLE_COL + i).value = role.personName ?? ''
  })

  for (const row of [head, sub]) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c)
      cell.font = { bold: row === head, size: row === head ? 11 : 9 }
      cell.alignment = {
        vertical: 'middle',
        horizontal: c <= 2 ? 'left' : 'center',
        wrapText: true,
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.border = border
    }
  }

  /* --------------------------------------------------------------- item rows */

  let rowIndex = 5
  const phaseMerges: [number, number][] = []

  for (const phase of summary.phases) {
    if (phase.items.length === 0) continue
    const firstRow = rowIndex

    for (const item of phase.items) {
      const row = ws.getRow(rowIndex)
      row.getCell(1).value = phase.name
      row.getCell(2).value = item.activityLabel
        ? `${item.detail}\n[${item.activityLabel} · ${item.complexity}]`
        : `${item.detail} [${item.complexity}]`
      row.getCell(3).value = item.dueDatePlan ?? ''
      row.getCell(4).value = item.deliverables ?? ''

      roles.forEach((role, i) => {
        const value = item.mandayByRole.get(role.id) ?? 0
        const cell = row.getCell(FIRST_ROLE_COL + i)
        cell.value = value || null
        cell.numFmt = '0.##'
        cell.alignment = { horizontal: 'center' }
      })

      for (let c = 1; c <= lastCol; c++) {
        const cell = row.getCell(c)
        cell.border = border
        if (c === 1 || c === 2) {
          cell.alignment = { vertical: 'top', wrapText: true }
        }
      }
      rowIndex++
    }

    // Roles estimated per phase rather than per item get one row of their own,
    // so the column totals below still add up.
    if (phase.derivedByRole.size > 0) {
      const row = ws.getRow(rowIndex)
      row.getCell(1).value = phase.name
      row.getCell(2).value =
        `[คิดตามสัดส่วนของ Developer ${phase.devManday} MD ทั้ง phase]`
      roles.forEach((role, i) => {
        const cell = row.getCell(FIRST_ROLE_COL + i)
        const value = phase.derivedByRole.get(role.id) ?? 0
        cell.value = value || null
        cell.numFmt = '0.##'
        cell.alignment = { horizontal: 'center' }
      })
      for (let c = 1; c <= lastCol; c++) {
        const cell = row.getCell(c)
        cell.border = border
        if (c === 1 || c === 2) {
          cell.alignment = { vertical: 'top', wrapText: true }
        }
        if (c === 2) cell.font = { italic: true, size: 10 }
      }
      rowIndex++
    }

    if (rowIndex - 1 > firstRow) phaseMerges.push([firstRow, rowIndex - 1])
  }

  // Merge the phase name down its own rows, the way column A of the template does.
  for (const [from, to] of phaseMerges) {
    ws.mergeCells(from, 1, to, 1)
    ws.getCell(from, 1).alignment = { vertical: 'middle', wrapText: true }
  }

  const lastItemRow = rowIndex - 1
  const hasItems = lastItemRow >= 5

  /* --------------------------------------------------- total / rate / cost */

  const totalRow = ws.getRow(rowIndex)
  totalRow.getCell(1).value = '★ รวมทั้งหมด (MD)'
  ws.mergeCells(rowIndex, 1, rowIndex, HEADERS.length)
  roles.forEach((role, i) => {
    const col = FIRST_ROLE_COL + i
    const letter = ws.getColumn(col).letter
    const cell = totalRow.getCell(col)
    cell.value = hasItems
      ? { formula: `SUM(${letter}5:${letter}${lastItemRow})`, result: role.manday }
      : role.manday
    cell.numFmt = '0.##'
    cell.alignment = { horizontal: 'center' }
  })
  const totalRowIndex = rowIndex
  rowIndex++

  const rateRow = ws.getRow(rowIndex)
  rateRow.getCell(1).value = 'อัตราต่อ Man-day (บาท)'
  ws.mergeCells(rowIndex, 1, rowIndex, HEADERS.length)
  roles.forEach((role, i) => {
    const cell = rateRow.getCell(FIRST_ROLE_COL + i)
    cell.value = role.ratePerMd
    cell.numFmt = '#,##0'
    cell.alignment = { horizontal: 'center' }
  })
  const rateRowIndex = rowIndex
  rowIndex++

  const costRow = ws.getRow(rowIndex)
  costRow.getCell(1).value = 'ค่าใช้จ่าย (บาท)'
  ws.mergeCells(rowIndex, 1, rowIndex, HEADERS.length)
  roles.forEach((role, i) => {
    const col = FIRST_ROLE_COL + i
    const letter = ws.getColumn(col).letter
    const cell = costRow.getCell(col)
    cell.value = {
      formula: `${letter}${totalRowIndex}*${letter}${rateRowIndex}`,
      result: role.cost,
    }
    cell.numFmt = '#,##0'
    cell.alignment = { horizontal: 'center' }
  })
  const costRowIndex = rowIndex
  rowIndex++

  let bufferRowIndex: number | null = null
  if (summary.bufferPercent > 0) {
    const bufferRow = ws.getRow(rowIndex)
    bufferRow.getCell(1).value =
      `Buffer / Contingency ${summary.bufferPercent}% (บาท)`
    ws.mergeCells(rowIndex, 1, rowIndex, HEADERS.length)
    const cell = bufferRow.getCell(FIRST_ROLE_COL)
    if (roles.length) {
      const first = ws.getColumn(FIRST_ROLE_COL).letter
      const last = ws.getColumn(FIRST_ROLE_COL + roles.length - 1).letter
      cell.value = {
        formula: `SUM(${first}${costRowIndex}:${last}${costRowIndex})*${summary.bufferPercent}/100`,
        result: summary.bufferAmount,
      }
    } else {
      cell.value = summary.bufferAmount
    }
    cell.numFmt = '#,##0'
    cell.alignment = { horizontal: 'center' }
    if (roles.length > 1) {
      ws.mergeCells(rowIndex, FIRST_ROLE_COL, rowIndex, lastCol)
    }
    bufferRowIndex = rowIndex
    rowIndex++
  }

  rowIndex++

  const grandRow = ws.getRow(rowIndex)
  grandRow.getCell(1).value = summary.bufferPercent
    ? 'รวมค่าใช้จ่ายทั้งโครงการ รวม Buffer (บาท)'
    : 'รวมค่าใช้จ่ายทั้งโครงการ (บาท)'
  ws.mergeCells(rowIndex, 1, rowIndex, HEADERS.length)
  const grandCell = grandRow.getCell(FIRST_ROLE_COL)
  if (roles.length) {
    const first = ws.getColumn(FIRST_ROLE_COL).letter
    const last = ws.getColumn(FIRST_ROLE_COL + roles.length - 1).letter
    const costSum = `SUM(${first}${costRowIndex}:${last}${costRowIndex})`
    grandCell.value = {
      formula: bufferRowIndex
        ? `${costSum}+${first}${bufferRowIndex}`
        : costSum,
      result: summary.totalCost,
    }
  } else {
    grandCell.value = summary.totalCost
  }
  grandCell.numFmt = '#,##0'
  if (roles.length > 1) {
    ws.mergeCells(rowIndex, FIRST_ROLE_COL, rowIndex, lastCol)
  }
  grandCell.alignment = { horizontal: 'center' }

  const styledRows = [totalRowIndex, rateRowIndex, costRowIndex, rowIndex]
  if (bufferRowIndex) styledRows.push(bufferRowIndex)
  for (const index of styledRows) {
    const row = ws.getRow(index)
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c)
      cell.border = border
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === rowIndex ? HEADER_FILL : TOTAL_FILL },
      }
    }
  }

  /* ------------------------------------------- sheet: the survey as answered */

  if (summary.survey) {
    const survey = summary.survey
    const qs = wb.addWorksheet('Questionnaire', {
      views: [{ state: 'frozen', ySplit: 6 }],
    })
    qs.columns = [
      { width: 8 },
      { width: 48 },
      { width: 16 },
      { width: 7 },
      { width: 7 },
      { width: 7 },
      { width: 9 },
      { width: 52 },
    ]
    const LAST = 8

    qs.getCell(1, 1).value = `แบบสำรวจ: ${survey.name}`
    qs.getCell(1, 1).font = { bold: true, size: 13, color: { argb: BRAND } }
    qs.mergeCells(1, 1, 1, LAST)

    if (survey.description) {
      qs.getCell(2, 1).value = survey.description
      qs.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' }
      qs.mergeCells(2, 1, 2, LAST)
    }

    qs.getCell(3, 1).value =
      `ตอบแล้ว ${survey.answeredTopics} / ${survey.totalTopics} หัวข้อ · ` +
      `รวม ${survey.totalQty} หน่วย — จำนวนคิดตามหน่วยนับของแต่ละหัวข้อ ` +
      `และหัวข้อเดียวกรอกได้ทั้งระดับ L, M และ H พร้อมกัน ` +
      `· หัวข้อที่เว้นว่างคือถามแล้วไม่มีงานในโครงการนี้`
    qs.getCell(3, 1).font = { italic: true, size: 10 }
    qs.getCell(3, 1).alignment = { wrapText: true, vertical: 'top' }
    qs.mergeCells(3, 1, 3, LAST)
    qs.getRow(3).height = 28

    const surveyHead = qs.getRow(5)
    const surveySub = qs.getRow(6)
    const headings = ['#', 'หัวข้อ', 'หน่วยนับ']
    headings.forEach((label, i) => {
      surveyHead.getCell(i + 1).value = label
      qs.mergeCells(5, i + 1, 6, i + 1)
    })
    surveyHead.getCell(4).value = 'จำนวนตามระดับความซับซ้อน'
    qs.mergeCells(5, 4, 5, 6)
    ;['L', 'M', 'H'].forEach((level, i) => {
      surveySub.getCell(4 + i).value = level
    })
    surveyHead.getCell(7).value = 'รวม'
    qs.mergeCells(5, 7, 6, 7)
    surveyHead.getCell(8).value = 'Details ที่กำหนดเอง'
    qs.mergeCells(5, 8, 6, 8)

    for (const row of [surveyHead, surveySub]) {
      for (let c = 1; c <= LAST; c++) {
        const cell = row.getCell(c)
        cell.font = { bold: true, size: 10 }
        cell.alignment = {
          vertical: 'middle',
          horizontal: c === 2 || c === 8 ? 'left' : 'center',
          wrapText: true,
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL },
        }
        cell.border = border
      }
    }

    let qsRow = 7
    let lastGroup: string | null | undefined
    const dataRows: number[] = []

    for (const item of survey.rows) {
      if (item.groupName && item.groupName !== lastGroup) {
        const groupRow = qs.getRow(qsRow)
        groupRow.getCell(1).value = item.groupName
        qs.mergeCells(qsRow, 1, qsRow, LAST)
        groupRow.getCell(1).font = { bold: true, color: { argb: BRAND } }
        groupRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF4F6F8' },
        }
        groupRow.getCell(1).border = border
        qsRow++
      }
      lastGroup = item.groupName

      const row = qs.getRow(qsRow)
      row.getCell(1).value = item.code
      row.getCell(2).value = item.name
      row.getCell(3).value = item.countUnit
      ;(['L', 'M', 'H'] as const).forEach((complexity, i) => {
        const cell = row.getCell(4 + i)
        cell.value = item.qty[complexity] || null
        cell.numFmt = '0.##'
      })
      row.getCell(7).value = item.total || null
      row.getCell(7).numFmt = '0.##'
      // null rather than '' so the cell is genuinely blank to COUNTA and filters.
      row.getCell(8).value = item.details.length
        ? item.details.join('\n')
        : null

      for (let c = 1; c <= LAST; c++) {
        const cell = row.getCell(c)
        cell.border = border
        cell.alignment = {
          vertical: 'top',
          horizontal: c === 2 || c === 8 ? 'left' : 'center',
          wrapText: c === 2 || c === 8,
        }
        // Tint the topics that carry an answer, so the ones that were asked and
        // came back empty stay visible but recede.
        if (item.total > 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F8FF' },
          }
        } else {
          cell.font = { color: { argb: 'FF98A2B3' } }
        }
      }
      dataRows.push(qsRow)
      qsRow++
    }

    if (dataRows.length) {
      const totalRow = qs.getRow(qsRow)
      totalRow.getCell(1).value = 'รวมทุกหัวข้อ'
      qs.mergeCells(qsRow, 1, qsRow, 3)
      for (let c = 4; c <= 7; c++) {
        const letter = qs.getColumn(c).letter
        const cell = totalRow.getCell(c)
        cell.value = {
          formula: `SUM(${letter}${dataRows[0]}:${letter}${dataRows.at(-1)})`,
          result:
            c === 7
              ? survey.totalQty
              : survey.rows.reduce(
                  (sum, r) => sum + r.qty[(['L', 'M', 'H'] as const)[c - 4]],
                  0,
                ),
        }
        cell.numFmt = '0.##'
      }
      totalRow.getCell(8).value =
        `${survey.answeredTopics} หัวข้อที่ตอบ จาก ${survey.totalTopics} หัวข้อที่ถาม`
      for (let c = 1; c <= LAST; c++) {
        const cell = totalRow.getCell(c)
        cell.font = { bold: true }
        cell.border = border
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: TOTAL_FILL },
        }
        cell.alignment = {
          horizontal: c === 1 || c === 8 ? 'left' : 'center',
          vertical: 'top',
        }
      }
    }
  }

  /* --------------------------------------------- last sheet: basis of estimate */

  const basis = wb.addWorksheet('Basis of Estimate')
  basis.columns = [{ width: 34 }, { width: 60 }]
  const facts: [string, string | number][] = [
    ['โครงการ', summary.project.name],
    ['รหัสโครงการ', summary.project.code ?? '-'],
    ['ระยะเวลา (วัน)', summary.project.durationDays ?? '-'],
    [
      'Technology Stack',
      summary.stack
        ? `${summary.stack.name} (×${summary.stackMultiplier})`
        : 'ไม่ระบุ (×1)',
    ],
    [
      'ตัวปรับที่เลือก',
      summary.modifiers.length
        ? summary.modifiers.map((m) => `${m.name} (×${m.multiplier})`).join('\n')
        : 'ไม่มี',
    ],
    ['ตัวคูณรวมที่ใช้คำนวณ', `×${summary.effectiveMultiplier}`],
    ['ตัวคูณมีผลกับบทบาท', 'Developer และ Developer (Senior) เท่านั้น'],
    [
      'แบบสำรวจที่ใช้',
      summary.survey
        ? `${summary.survey.name} — ตอบ ${summary.survey.answeredTopics}/${summary.survey.totalTopics} หัวข้อ (ดูชีต Questionnaire)`
        : 'ไม่ได้ใช้แบบสำรวจ — key รายการเอง',
    ],
    ['จำนวนรายการ', summary.itemCount],
    ['รวม Man-day', summary.totalManday],
    ['Developer Man-day (ฐานคิดสัดส่วน)', summary.devTotal],
    [
      'สัดส่วนต่อ Developer',
      summary.roles
        .filter((r) => r.actualRatio != null)
        .map((r) => {
          const actual = `${Math.round(r.actualRatio! * 100)}%`
          const target = r.targetRatio
            ? ` (เป้า ${Math.round(r.targetRatio * 100)}%)`
            : ''
          return `${r.name} ${actual}${target}`
        })
        .join('\n') || '-',
    ],
    [
      'บทบาทที่คิดแบบ phase',
      summary.roles
        .filter((r) => r.scope === 'phase')
        .map((r) => r.name)
        .join(', ') || 'ไม่มี (คิดรายบรรทัดทั้งหมด)',
    ],
    ['ค่าใช้จ่ายก่อน Buffer (บาท)', summary.cost],
    [
      'Buffer / Contingency',
      summary.bufferPercent
        ? `${summary.bufferPercent}% = ${summary.bufferAmount.toLocaleString('th-TH')} บาท`
        : 'ไม่มี',
    ],
    ['รวมค่าใช้จ่าย (บาท)', summary.totalCost],
    [
      'อ้างอิงมาตรฐาน',
      `${STANDARD.source} ${STANDARD.version} (Activity × L/M/H × Role) — ค่า MD คิดตามหน่วยนับของแต่ละแถว`,
    ],
    ['สร้างเมื่อ', new Date().toLocaleString('th-TH')],
  ]
  basis.addRow(['สรุปสมมติฐานการประเมิน']).font = {
    bold: true,
    size: 13,
    color: { argb: BRAND },
  }
  basis.addRow([])
  for (const [label, value] of facts) {
    const row = basis.addRow([label, value])
    row.getCell(1).font = { bold: true }
    row.getCell(1).alignment = { vertical: 'top' }
    row.getCell(2).alignment = { vertical: 'top', wrapText: true }
  }

  return wb
}

export async function workbookBuffer(summary: Summary) {
  const wb = await buildWorkbook(summary)
  return wb.xlsx.writeBuffer()
}
