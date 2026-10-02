import { Fragment } from 'react'

import { requireUser } from '@/lib/dal'
import {
  LEVEL_DECISION_RULE,
  LEVEL_DEF,
  WORK_TYPE_LEVELS,
} from '@/lib/work-level-criteria'
import { STANDARD } from '@/lib/standard'

import { MatrixTabs } from '../matrix-tabs'

export const metadata = { title: 'เกณฑ์ระดับงาน | Standard Matrix' }

const LEVEL_STYLES = [
  { label: 'Low', className: 'text-emerald-700' },
  { label: 'Medium', className: 'text-amber-700' },
  { label: 'High', className: 'text-rose-700' },
] as const

export default async function WorkLevelCriteriaPage() {
  const user = await requireUser()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">เกณฑ์ระดับงาน</h1>
        <p className="mt-1 text-sm text-muted">
          แนวทางเทียบระดับความซับซ้อนของงาน ใช้ประกอบการประเมิน Low, Medium และ
          High
        </p>
      </div>

      <MatrixTabs active="criteria" isAdmin={user.role === 'admin'} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">ภาพรวมระดับความซับซ้อน</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {STANDARD.complexityLegend.map((level, index) => {
            const style = LEVEL_STYLES[index]
            return (
              <article key={level.label} className="card space-y-2 p-4">
                <h3 className={`text-sm font-semibold ${style.className}`}>
                  {level.label}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {level.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">เกณฑ์แยกตามลักษณะงาน</h2>
          <p className="mt-0.5 text-xs text-muted">
            เปรียบเทียบเงื่อนไขของแต่ละงานในระดับ Low, Medium และ High
          </p>
        </div>

        <div className="space-y-3">
          {LEVEL_DEF.map((item, index) => (
            <Fragment key={`${item.topic}-${index}`}>
              {item.num !== null ? (
                <h3 className="pt-2 text-sm font-semibold text-foreground">
                  {item.num}. {item.topic}
                </h3>
              ) : null}

              {item.low || item.medium || item.high ? (
                <article className="card space-y-3 p-3 sm:p-4">
                  {item.num === null ? (
                    <h4 className="text-sm font-semibold">{item.topic}</h4>
                  ) : null}
                  <div className="grid gap-2 md:grid-cols-3">
                    {[item.low, item.medium, item.high].map((description, i) => (
                      <div
                        key={LEVEL_STYLES[i].label}
                        className="rounded-md border border-line bg-background p-3"
                      >
                        <p
                          className={`mb-1 text-xs font-semibold ${LEVEL_STYLES[i].className}`}
                        >
                          {LEVEL_STYLES[i].label}
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                          {description || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            เกณฑ์เฉพาะตาม Work Type และหน่วยนับ
          </h2>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-brand-soft/60 text-xs">
                <th className="w-48 border-b border-line px-3 py-2 text-left font-semibold">
                  Work Type
                </th>
                <th className="w-36 border-b border-line px-3 py-2 text-left font-semibold">
                  Unit
                </th>
                {LEVEL_STYLES.map((level) => (
                  <th
                    key={level.label}
                    className="min-w-64 border-b border-line px-3 py-2 text-left font-semibold"
                  >
                    {level.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORK_TYPE_LEVELS.map((item) => (
                <tr key={item.type} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-3 align-top font-medium">{item.type}</td>
                  <td className="px-3 py-3 align-top text-muted">{item.unit}</td>
                  {[item.low, item.medium, item.high].map((description, index) => (
                    <td
                      key={LEVEL_STYLES[index].label}
                      className="px-3 py-3 align-top leading-relaxed text-muted"
                    >
                      {description}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-md bg-brand-soft/50 px-3 py-2 text-sm leading-relaxed">
        <span className="font-semibold">หลักการตัดสิน:</span>{' '}
        {LEVEL_DECISION_RULE}
      </p>
    </div>
  )
}
