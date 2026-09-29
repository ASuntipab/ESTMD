import Link from 'next/link'

import {
  addPhase,
  deleteItem,
  deletePhase,
  overrideManday,
  renamePhase,
  resetToStandard,
} from '@/lib/actions/project'
import type { Activity } from '@/lib/db/schema'
import { round2 } from '@/lib/estimate'
import type { ProjectDetail } from '@/lib/queries'

import { AddItemForm } from './add-item-form'

export function StepItems({
  detail,
  activities,
  readOnly,
}: {
  detail: ProjectDetail
  activities: Activity[]
  readOnly: boolean
}) {
  const { project, phases, items, mandays, roles, stack } = detail

  const costedRoles = roles.filter((role) =>
    detail.projectRoles.some((pr) => pr.roleId === role.id && pr.included),
  )
  const activityById = new Map(activities.map((a) => [a.id, a]))
  const mandayOf = new Map(
    mandays.map((m) => [`${m.itemId}_${m.roleId}`, m]),
  )

  const itemTotal = (itemId: number) =>
    round2(
      costedRoles.reduce(
        (sum, r) => sum + (mandayOf.get(`${itemId}_${r.id}`)?.manday ?? 0),
        0,
      ),
    )

  const grandTotal = round2(items.reduce((s, i) => s + itemTotal(i.id), 0))

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span title={detail.modifiers.map((m) => m.name).join(', ')}>
            <span className="text-muted">ตัวคูณรวม:</span>{' '}
            <span className="font-medium tabular-nums">
              ×{detail.effectiveMultiplier}
            </span>{' '}
            <span className="text-xs text-muted">
              ({stack ? stack.name : 'ไม่ระบุ stack'}
              {detail.modifiers.length
                ? ` + ${detail.modifiers.length} ตัวปรับ`
                : ''}
              )
            </span>
          </span>
          <span>
            <span className="text-muted">รวมทั้งหมด:</span>{' '}
            <span className="font-semibold tabular-nums">{grandTotal} MD</span>
          </span>
          <span>
            <span className="text-muted">รายการ:</span>{' '}
            <span className="tabular-nums">{items.length}</span>
          </span>
        </div>
        {readOnly ? null : (
          <form action={resetToStandard}>
            <input type="hidden" name="projectId" value={project.id} />
            <button type="submit" className="btn-ghost text-xs">
              คำนวณใหม่จาก Standard Matrix
            </button>
          </form>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          เริ่มจากสร้าง Phase เช่น “Auth &amp; Authorization” หรือ “เมนู Admin”
        </div>
      ) : null}

      {phases.map((phase) => {
        const phaseItems = items.filter((i) => i.phaseId === phase.id)
        const phaseTotal = round2(
          phaseItems.reduce((s, i) => s + itemTotal(i.id), 0),
        )

        return (
          <section key={phase.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-soft/40 px-4 py-2.5">
              {readOnly ? (
                <h2 className="flex-1 font-medium">{phase.name}</h2>
              ) : (
                <form
                  action={renamePhase}
                  className="flex flex-1 flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={phase.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input
                    name="name"
                    defaultValue={phase.name}
                    aria-label="ชื่อ Phase"
                    className="field h-8 max-w-sm flex-1 font-medium"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    ลำดับ
                    <input
                      name="sortOrder"
                      type="number"
                      step="10"
                      defaultValue={phase.sortOrder}
                      title="ลำดับการเรียง Phase — เลขน้อยอยู่บน เพิ่มทีละ 10 เพื่อให้แทรก Phase ใหม่ตรงกลางได้"
                      className="field h-8 w-16 text-center text-sm tabular-nums"
                    />
                  </label>
                  <button type="submit" className="btn-ghost h-8 text-xs">
                    บันทึก
                  </button>
                </form>
              )}
              <span className="text-sm tabular-nums">
                <span className="text-muted">รวม</span>{' '}
                <span className="font-semibold">{phaseTotal} MD</span>
              </span>
              {readOnly ? null : (
                <form action={deletePhase}>
                  <input type="hidden" name="id" value={phase.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    ลบ Phase
                  </button>
                </form>
              )}
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-background text-xs text-muted">
                    <th className="border-b border-line px-3 py-2 text-left font-semibold">
                      Details
                    </th>
                    <th className="w-36 border-b border-line px-2 py-2 text-left font-semibold">
                      Activity
                    </th>
                    <th className="w-16 border-b border-line px-2 py-2 text-center font-semibold">
                      ระดับ
                    </th>
                    <th className="w-24 border-b border-line px-2 py-2 text-center font-semibold">
                      จำนวน
                    </th>
                    {costedRoles.map((role) => (
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
                    <th className="w-16 border-b border-line px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {phaseItems.map((item) => {
                    const activity = item.activityId
                      ? activityById.get(item.activityId)
                      : null
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-line/70 last:border-0 align-top"
                      >
                        <td className="px-3 py-2">
                          <p className="whitespace-pre-line">{item.detail}</p>
                        </td>
                        <td className="px-2 py-2 text-xs text-muted">
                          {activity ? `${activity.code} ${activity.name}` : '-'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="chip bg-brand-soft text-brand">
                            {item.complexity}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="tabular-nums">{item.qty}</span>
                          {activity ? (
                            <span className="block text-[11px] leading-tight text-muted">
                              {activity.countUnit}
                            </span>
                          ) : null}
                        </td>

                        {costedRoles.map((role) => {
                          const cell = mandayOf.get(`${item.id}_${role.id}`)
                          return (
                            <td
                              key={role.id}
                              className="border-l border-line px-1 py-1.5"
                            >
                              {readOnly ? (
                                <span
                                  className={`block text-center tabular-nums ${
                                    cell?.manday ? '' : 'text-muted/40'
                                  }`}
                                >
                                  {cell?.manday || '-'}
                                </span>
                              ) : (
                                <form action={overrideManday}>
                                  <input
                                    type="hidden"
                                    name="itemId"
                                    value={item.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="roleId"
                                    value={role.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="projectId"
                                    value={project.id}
                                  />
                                  <input
                                    name="manday"
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    defaultValue={cell?.manday ?? 0}
                                    aria-label={`MD ${role.name} ของ ${item.detail}`}
                                    title={
                                      cell?.overridden
                                        ? 'แก้ไขเอง (ไม่ตรง Standard Matrix)'
                                        : 'ค่าจาก Standard Matrix'
                                    }
                                    className={`field h-8 px-1 text-center tabular-nums ${
                                      cell?.overridden
                                        ? 'border-accent/60 bg-accent/5'
                                        : ''
                                    }`}
                                  />
                                </form>
                              )}
                            </td>
                          )
                        })}

                        <td className="border-l border-line px-2 py-2 text-center font-semibold tabular-nums">
                          {itemTotal(item.id)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {readOnly ? null : (
                            <form action={deleteItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="projectId"
                                value={project.id}
                              />
                              <button
                                type="submit"
                                className="text-xs text-danger hover:underline"
                              >
                                ลบ
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {phaseItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + costedRoles.length}
                        className="px-3 py-6 text-center text-sm text-muted"
                      >
                        ยังไม่มีรายการใน Phase นี้
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {readOnly ? null : (
              <div className="border-t border-line bg-background/60 p-3">
                <AddItemForm
                  projectId={project.id}
                  phaseId={phase.id}
                  activities={activities.filter((a) => a.active)}
                />
              </div>
            )}
          </section>
        )
      })}

      {readOnly ? null : (
        <form action={addPhase} className="card flex flex-wrap items-end gap-2 p-4">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="flex-1">
            <label className="label" htmlFor="new-phase">
              เพิ่ม Phase
            </label>
            <input
              id="new-phase"
              name="name"
              required
              placeholder="เช่น Auth & Authorization"
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary">
            + เพิ่ม Phase
          </button>
        </form>
      )}

      <div className="flex justify-between">
        <Link href={`/projects/${project.id}?step=2`} className="btn-ghost">
          ย้อนกลับ
        </Link>
        <Link href={`/projects/${project.id}?step=4`} className="btn-primary">
          ถัดไป: ทีม &amp; อัตรา
        </Link>
      </div>
    </div>
  )
}
