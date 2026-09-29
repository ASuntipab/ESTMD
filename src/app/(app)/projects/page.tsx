import Link from 'next/link'

import { requireUser } from '@/lib/dal'
import { listProjects } from '@/lib/queries'

export const metadata = { title: 'โครงการ | Manday Estimation' }

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft: { text: 'ร่าง', className: 'bg-background text-muted' },
  in_review: { text: 'รอทบทวน', className: 'bg-accent/10 text-accent' },
  approved: { text: 'อนุมัติแล้ว', className: 'bg-ok/10 text-ok' },
}

export default async function ProjectsPage() {
  const user = await requireUser()
  const rows = await listProjects()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">โครงการ</h1>
          <p className="mt-1 text-sm text-muted">
            key รายการประเมินแบบ wizard แล้ว export ตาม template
            PTT-PSSR-Online_Manday.xlsx
          </p>
        </div>
        {user.role === 'viewer' ? null : (
          <Link href="/projects/new" className="btn-primary">
            + สร้างโครงการ
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-muted">ยังไม่มีโครงการ</p>
          {user.role === 'viewer' ? null : (
            <Link href="/projects/new" className="btn-primary mt-4">
              สร้างโครงการแรก
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-soft/60 text-xs">
                <th className="border-b border-line px-4 py-2.5 text-left font-semibold">
                  ชื่อโครงการ
                </th>
                <th className="w-32 border-b border-line px-4 py-2.5 text-left font-semibold">
                  รหัส
                </th>
                <th className="border-b border-line px-4 py-2.5 text-left font-semibold">
                  Technology Stack
                </th>
                <th className="w-32 border-b border-line px-4 py-2.5 text-center font-semibold">
                  สถานะ
                </th>
                <th className="w-32 border-b border-line px-4 py-2.5 text-center font-semibold">
                  ขั้นตอน
                </th>
                <th className="w-28 border-b border-line px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft
                return (
                  <tr
                    key={p.id}
                    className="border-b border-line/70 last:border-0 hover:bg-brand-soft/20"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/projects/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {p.code ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {p.techStackName ?? 'ยังไม่ระบุ'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`chip ${status.className}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-muted tabular-nums">
                      {p.wizardStep} / 5
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/projects/${p.id}/summary`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        สรุป
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
