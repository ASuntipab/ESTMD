import Link from 'next/link'

import { SummaryView } from '@/components/summary-view'
import type { ProjectDetail } from '@/lib/queries'
import { buildSummary } from '@/lib/summary'

export function StepSummary({ detail }: { detail: ProjectDetail }) {
  const summary = buildSummary(detail)

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">
          ตรวจตัวเลขแล้ว export เป็น Excel ตามรูปแบบ
          PTT-PSSR-Online_Manday.xlsx
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${detail.project.id}/summary`} className="btn-ghost">
            เปิดหน้าสรุปเต็ม
          </Link>
          <a
            href={`/api/projects/${detail.project.id}/export`}
            className="btn-primary"
          >
            ⬇ Export Excel
          </a>
        </div>
      </div>

      <SummaryView summary={summary} />

      <div className="flex justify-between">
        <Link href={`/projects/${detail.project.id}?step=4`} className="btn-ghost">
          ย้อนกลับ
        </Link>
      </div>
    </div>
  )
}
