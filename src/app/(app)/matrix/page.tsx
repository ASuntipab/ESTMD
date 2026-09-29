import { Fragment } from 'react'
import Link from 'next/link'

import { requireUser } from '@/lib/dal'
import { getMatrixLookup, listActivities, listRoles } from '@/lib/queries'
import { cellKey } from '@/lib/estimate'
import { COMPLEXITIES } from '@/lib/db/schema'

import { MatrixTabs } from './matrix-tabs'

export const metadata = { title: 'Standard Matrix | Manday Estimation' }

export default async function MatrixPage() {
  const user = await requireUser()
  const [rows, roles, matrix] = await Promise.all([
    listActivities(),
    listRoles(),
    getMatrixLookup(),
  ])

  // Only the roles the matrix actually carries values for get a column here.
  const scoredRoles = roles.filter((role) =>
    rows.some((a) =>
      COMPLEXITIES.some((c) => (matrix.get(cellKey(a.id, role.id, c)) ?? 0) > 0),
    ),
  )

  // Precompute where each group heading row goes, so the render stays pure.
  const withHeadings = rows.map((activity, index) => ({
    activity,
    heading:
      activity.groupName && activity.groupName !== rows[index - 1]?.groupName
        ? activity.groupName
        : null,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">MD Estimation Standard Matrix</h1>
          <p className="mt-1 text-sm text-muted">
            ตารางกลาง Activity × ระดับความซับซ้อน (L / M / H) × บทบาท —{' '}
            {rows.length} รายการ
          </p>
        </div>
        {user.role === 'admin' ? (
          <Link href="/matrix/new" className="btn-primary">
            + เพิ่ม Activity
          </Link>
        ) : null}
      </div>

      <MatrixTabs active="activities" isAdmin={user.role === 'admin'} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-soft/60 text-xs">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 border-b border-line bg-brand-soft/60 px-3 py-2 text-left font-semibold"
              >
                #
              </th>
              <th
                rowSpan={2}
                className="border-b border-line px-3 py-2 text-left font-semibold"
              >
                Topic
              </th>
              <th
                rowSpan={2}
                className="border-b border-line px-2 py-2 text-center font-semibold"
              >
                หน่วยนับ
              </th>
              {scoredRoles.map((role) => (
                <th
                  key={role.id}
                  colSpan={3}
                  className="border-b border-l border-line px-2 py-2 text-center font-semibold"
                >
                  {role.name}
                </th>
              ))}
              <th
                rowSpan={2}
                className="border-b border-l border-line px-3 py-2 text-right font-semibold"
              >
                จัดการ
              </th>
            </tr>
            <tr className="bg-brand-soft/30 text-[11px] text-muted">
              {scoredRoles.flatMap((role) =>
                COMPLEXITIES.map((c, i) => (
                  <th
                    key={`${role.id}-${c}`}
                    className={`w-12 border-b border-line px-1 py-1 text-center font-semibold ${
                      i === 0 ? 'border-l' : ''
                    }`}
                  >
                    {c}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {withHeadings.map(({ activity: a, heading }) => (
                <Fragment key={a.id}>
                  {heading ? (
                    <tr className="bg-background">
                      <td
                        colSpan={4 + scoredRoles.length * 3}
                        className="border-b border-line px-3 py-1.5 text-xs font-semibold text-brand"
                      >
                        {heading}
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    className={`border-b border-line/70 last:border-0 hover:bg-brand-soft/20 ${
                      a.active ? '' : 'text-muted/60'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-mono text-xs">
                      {a.code}
                    </td>
                    <td className="px-3 py-2">
                      {a.name}
                      {a.notes ? (
                        <span
                          className="chip ml-2 bg-accent/10 text-accent"
                          title={a.notes}
                        >
                          ค่าตั้งต้น
                        </span>
                      ) : null}
                      {a.active ? null : (
                        <span className="chip ml-2 bg-danger/10 text-danger">
                          ปิดใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-muted">
                      {a.countUnit}
                    </td>
                    {scoredRoles.flatMap((role) =>
                      COMPLEXITIES.map((c, i) => {
                        const v = matrix.get(cellKey(a.id, role.id, c)) ?? 0
                        return (
                          <td
                            key={`${a.id}-${role.id}-${c}`}
                            className={`px-1 py-2 text-center tabular-nums ${
                              i === 0 ? 'border-l border-line' : ''
                            } ${v ? '' : 'text-muted/40'}`}
                          >
                            {v || '-'}
                          </td>
                        )
                      }),
                    )}
                    <td className="border-l border-line px-3 py-2 text-right">
                      <Link
                        href={`/matrix/${a.id}`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {user.role === 'admin' ? 'แก้ไข' : 'ดู'}
                      </Link>
                    </td>
                  </tr>
                </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
