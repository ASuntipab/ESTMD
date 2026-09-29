import { Fragment } from 'react'

import type { Summary } from '@/lib/summary'

const baht = (n: number) =>
  n.toLocaleString('th-TH', { maximumFractionDigits: 0 })

/**
 * Shows a role's man-days as a share of Developer man-days next to the target
 * from the standard, and flags it when it drifts more than a quarter off. It is
 * a sanity check, not a rule: the estimator decides whether to act on it.
 */
function RatioCheck({ role }: { role: Summary['roles'][number] }) {
  if (role.actualRatio == null) return <span className="text-muted/40">-</span>

  const actual = Math.round(role.actualRatio * 100)
  if (role.targetRatio == null) {
    return <span className="text-muted">{actual}%</span>
  }

  const target = Math.round(role.targetRatio * 100)
  const drift = role.actualRatio / role.targetRatio
  const off = drift > 1.25 || drift < 0.75

  return (
    <span
      className={off ? 'font-medium text-danger' : 'text-muted'}
      title={
        off
          ? `ต่างจากเป้า ${target}% เกิน 25% — ควรทบทวน`
          : `อยู่ในช่วงที่คาดไว้ (เป้า ${target}%)`
      }
    >
      {actual}% / {target}%{off ? ' ⚠' : ''}
    </span>
  )
}

export function SummaryView({ summary }: { summary: Summary }) {
  const { project, roles, phases } = summary

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'รวม Man-day',
            value: `${summary.totalManday} MD`,
            hint: undefined as string | undefined,
          },
          {
            label: 'รวมค่าใช้จ่าย',
            value: `${baht(summary.totalCost)} บาท`,
            hint:
              summary.bufferPercent > 0
                ? `รวม buffer ${summary.bufferPercent}% (${baht(summary.bufferAmount)})`
                : 'ไม่มี buffer',
          },
          { label: 'จำนวนรายการ', value: String(summary.itemCount) },
          {
            label: `ตัวคูณรวม ×${summary.effectiveMultiplier}`,
            value: summary.stack ? summary.stack.name : 'ไม่ระบุ stack',
            hint: summary.modifiers.length
              ? summary.modifiers
                  .map((m) => `${m.name} ×${m.multiplier}`)
                  .join(' · ')
              : 'ไม่มีตัวปรับ',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <dt className="text-xs text-muted">{kpi.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{kpi.value}</dd>
            {kpi.hint ? (
              <dd className="mt-0.5 text-xs text-muted">{kpi.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          สรุปตามบทบาท
        </h2>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-soft/60 text-xs">
              <th className="border-b border-line px-4 py-2 text-left font-semibold">
                บทบาท
              </th>
              <th className="w-28 border-b border-line px-3 py-2 text-left font-semibold">
                ระดับ
              </th>
              <th className="border-b border-line px-3 py-2 text-left font-semibold">
                ผู้รับผิดชอบ
              </th>
              <th className="w-24 border-b border-line px-3 py-2 text-center font-semibold">
                MD
              </th>
              <th className="w-36 border-b border-line px-3 py-2 text-center font-semibold">
                % ของ Dev / เป้า
              </th>
              <th className="w-32 border-b border-line px-3 py-2 text-right font-semibold">
                อัตรา / MD
              </th>
              <th className="w-36 border-b border-line px-4 py-2 text-right font-semibold">
                ค่าใช้จ่าย
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-line/70">
                <td className="px-4 py-2 font-medium">{role.name}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {role.resourceLabel ?? '-'}
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {role.personName ?? '-'}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {role.manday}
                  {role.scope === 'phase' ? (
                    <span className="ml-1 text-[10px] text-accent">phase</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  <RatioCheck role={role} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {baht(role.ratePerMd)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {baht(role.cost)}
                </td>
              </tr>
            ))}
            <tr className="bg-brand-soft/40 font-semibold">
              <td colSpan={3} className="px-4 py-2.5">
                ★ รวมทั้งหมด (MD)
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {summary.totalManday}
              </td>
              <td className="px-3 py-2.5 text-center text-xs font-normal text-muted">
                Dev {summary.devTotal} MD
              </td>
              <td />
              <td className="px-4 py-2.5 text-right tabular-nums">
                {baht(summary.cost)}
              </td>
            </tr>
            {summary.bufferPercent > 0 ? (
              <tr className="text-sm">
                <td colSpan={5} className="px-4 py-2 text-muted">
                  Buffer / Contingency {summary.bufferPercent}%
                </td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums">
                  {baht(summary.bufferAmount)}
                </td>
              </tr>
            ) : null}
            <tr className="bg-brand text-white">
              <td colSpan={5} className="px-4 py-2.5 font-semibold">
                รวมค่าใช้จ่ายทั้งโครงการ
                {summary.bufferPercent > 0 ? ' (รวม Buffer)' : ''}
              </td>
              <td />
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {baht(summary.totalCost)}
              </td>
            </tr>
          </tbody>
        </table>
        {roles.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            ยังไม่ได้เลือกบทบาทที่จะคิดค่าใช้จ่าย — กลับไปขั้นตอน “ทีม &amp; อัตรา”
          </p>
        ) : null}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          รายละเอียดตาม Phase
        </h2>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-soft/60 text-xs">
              <th className="w-40 border-b border-line px-4 py-2 text-left font-semibold">
                Phase
              </th>
              <th className="border-b border-line px-3 py-2 text-left font-semibold">
                Details
              </th>
              <th className="w-14 border-b border-line px-2 py-2 text-center font-semibold">
                ระดับ
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="w-20 border-b border-l border-line px-1 py-2 text-center font-semibold"
                >
                  {role.name}
                </th>
              ))}
              <th className="w-16 border-b border-l border-line px-2 py-2 text-center font-semibold">
                รวม
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) =>
              phase.items.length === 0 ? null : (
                <Fragment key={phase.id}>
                  {phase.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-b border-line/70 align-top"
                    >
                      {index === 0 ? (
                        <td
                          rowSpan={phase.items.length}
                          className="border-r border-line bg-background/50 px-4 py-2 font-medium"
                        >
                          {phase.name}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <span className="whitespace-pre-line">{item.detail}</span>
                        {item.activityLabel ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {item.activityLabel}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-center text-xs">
                        {item.complexity}
                      </td>
                      {roles.map((role) => {
                        const v = item.mandayByRole.get(role.id) ?? 0
                        return (
                          <td
                            key={role.id}
                            className={`border-l border-line px-1 py-2 text-center tabular-nums ${
                              v ? '' : 'text-muted/40'
                            }`}
                          >
                            {v || '-'}
                          </td>
                        )
                      })}
                      <td className="border-l border-line px-2 py-2 text-center font-medium tabular-nums">
                        {item.total}
                      </td>
                    </tr>
                  ))}
                  {phase.derivedByRole.size > 0 ? (
                    <tr className="bg-accent/5 text-xs">
                      <td className="border-r border-line" />
                      <td className="px-3 py-1.5 text-muted" colSpan={2}>
                        คิดตามสัดส่วนของ Developer ({phase.devManday} MD) ทั้ง phase
                      </td>
                      {roles.map((role) => {
                        const v = phase.derivedByRole.get(role.id) ?? 0
                        return (
                          <td
                            key={role.id}
                            className={`border-l border-line px-1 py-1.5 text-center tabular-nums ${
                              v ? 'font-medium text-accent' : 'text-muted/40'
                            }`}
                          >
                            {v || '-'}
                          </td>
                        )
                      })}
                      <td className="border-l border-line px-2 py-1.5 text-center tabular-nums">
                        {[...phase.derivedByRole.values()].reduce(
                          (a, b) => a + b,
                          0,
                        )}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="bg-background/60 text-xs">
                    <td className="border-r border-line" />
                    <td
                      colSpan={2 + roles.length}
                      className="px-3 py-1.5 text-right font-medium text-muted"
                    >
                      รวม {phase.name}
                    </td>
                    <td className="border-l border-line px-2 py-1.5 text-center font-semibold tabular-nums">
                      {phase.total}
                    </td>
                  </tr>
                </Fragment>
              ),
            )}
          </tbody>
        </table>
        {summary.itemCount === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            ยังไม่มีรายการประเมิน
          </p>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        โครงการ {project.name}
        {project.code ? ` (${project.code})` : ''}
        {project.durationDays ? ` · ระยะเวลา ${project.durationDays} วัน` : ''}
      </p>
    </div>
  )
}
