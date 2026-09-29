import { notFound } from 'next/navigation'

import { requireUser } from '@/lib/dal'
import { listStackModifiers, listTechStacks } from '@/lib/queries'

import { MatrixTabs } from '../matrix-tabs'
import { MultiplierForm } from './multiplier-form'
import {
  MultiplierRow,
  ROW_GRID,
  type MultiplierKind,
  type MultiplierRowData,
} from './multiplier-row'

export const metadata = { title: 'ตัวคูณ & ตัวปรับ | Standard Matrix' }

const COLUMN_HINTS = [
  { label: 'รายการ', hint: 'ชื่อที่จะไปแสดงในตัวเลือกของโครงการ' },
  { label: 'ตัวคูณ', hint: 'คูณค่า MD ของบทบาทที่ติดธง × stack เท่านั้น' },
  { label: 'หมายเหตุ', hint: 'เหตุผลที่ใช้ตัวคูณนี้ ให้คนประเมินรุ่นถัดไปเข้าใจที่มา' },
  {
    label: 'ลำดับ',
    hint: 'ลำดับการเรียง — เลขน้อยอยู่บน เพิ่มทีละ 10 เพื่อให้แทรกรายการใหม่ตรงกลางได้',
  },
] as const

function MultiplierTable({
  kind,
  rows,
  emptyText,
}: {
  kind: MultiplierKind
  rows: MultiplierRowData[]
  emptyText: string
}) {
  return (
    <div className="card overflow-hidden">
      <div
        className={`${ROW_GRID} hidden border-b border-line bg-brand-soft/60 px-3 py-2 lg:grid`}
      >
        {COLUMN_HINTS.map((column) => (
          <span
            key={column.label}
            title={column.hint}
            className="cursor-help text-xs font-semibold"
          >
            {column.label}
          </span>
        ))}
        <span className="text-right text-xs font-semibold">จัดการ</span>
      </div>

      {rows.map((row) => (
        <MultiplierRow key={row.id} kind={kind} row={row} />
      ))}

      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">{emptyText}</p>
      ) : null}
    </div>
  )
}

export default async function TechStacksPage() {
  const user = await requireUser()
  if (user.role !== 'admin') notFound()

  // Retired rows are shown too, so an admin can see and revive them.
  const [stacks, modifiers] = await Promise.all([
    listTechStacks({ includeInactive: true }),
    listStackModifiers({ includeInactive: true }),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ตัวคูณ &amp; ตัวปรับ</h1>
        <p className="mt-1 text-sm text-muted">
          ทั้งสองตารางใช้กับบทบาทที่ติดธง “× stack” (Developer และ Developer
          (Senior)) เท่านั้น — SA / BA / Tester ไม่ถูกคูณ
        </p>
        <p className="mt-2 rounded-md bg-brand-soft/50 px-3 py-2 text-sm">
          <span className="font-medium">สูตร:</span> MD = ค่าในเมทริกซ์ ×
          จำนวนตามหน่วยนับ × ตัวคูณ Stack (เลือก 1) × ตัวปรับทุกตัวที่เลือก
          (คูณต่อเนื่อง)
        </p>
        <p className="mt-2 text-xs text-muted">
          แก้ค่าในตารางได้เลยแล้วกด “บันทึก” — การแก้ตัวคูณ{' '}
          <span className="font-medium">ไม่</span> เปลี่ยนโครงการที่ประเมินไว้แล้ว
          จนกว่าจะกด “คำนวณใหม่จาก Standard Matrix” ในโครงการนั้น · รายการที่มี
          โครงการใช้อยู่จะถูกปิดใช้งานแทนการลบ เพื่อให้ตัวเลขเดิมยังอธิบายได้
        </p>
      </div>

      <MatrixTabs active="tech-stacks" isAdmin />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Technology Stack — เลือก 1 รายการ</h2>
          <p className="mt-0.5 text-xs text-muted">
            stack ที่ใช้พัฒนาจริง สะท้อนความคุ้นเคยของทีมและความสมบูรณ์ของ library
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <MultiplierTable kind="stack" rows={stacks} emptyText="ยังไม่มีข้อมูล" />
          <MultiplierForm kind="stack" />
        </div>
      </section>

      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold">
            ตัวปรับ — เลือกได้หลายรายการ คูณทับกัน
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            เงื่อนไขที่เพิ่มงานโดยไม่ขึ้นกับ stack เช่น Responsive ×1.15 บน stack
            ที่ทีมไม่คุ้น ×1.4 รวมเป็น ×1.61
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <MultiplierTable
            kind="modifier"
            rows={modifiers}
            emptyText="ยังไม่มีตัวปรับ"
          />
          <MultiplierForm kind="modifier" />
        </div>
      </section>
    </div>
  )
}
