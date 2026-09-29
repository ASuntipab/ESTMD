'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { deleteActivity, saveActivity, type ActionState } from '@/lib/actions/matrix'
import {
  COMPLEXITIES,
  ONCE_PER_PROJECT_UNIT,
  type Activity,
} from '@/lib/db/schema'
import type { RoleLike } from '@/lib/estimate'

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : label}
    </button>
  )
}

export function ActivityForm({
  activity,
  roles,
  countUnits,
  cells,
  readOnly,
  saved,
}: {
  activity: Activity | null
  roles: RoleLike[]
  /** Units already in use, offered as suggestions. */
  countUnits: string[]
  /** `${roleId}_${complexity}` -> manday */
  cells: Record<string, number>
  readOnly: boolean
  saved?: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveActivity,
    {},
  )

  return (
    <div className="space-y-4">
      {saved && !state.error ? (
        <p className="rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
          บันทึกเรียบร้อย
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        {activity ? <input type="hidden" name="id" value={activity.id} /> : null}

        <fieldset disabled={readOnly} className="card space-y-4 p-5">
          <legend className="sr-only">ข้อมูล Activity</legend>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="code">
                รหัส *
              </label>
              <input
                id="code"
                name="code"
                required
                defaultValue={activity?.code ?? ''}
                className="field font-mono"
                placeholder="1.7"
              />
            </div>
            <div>
              <label className="label" htmlFor="groupName">
                กลุ่ม
              </label>
              <input
                id="groupName"
                name="groupName"
                defaultValue={activity?.groupName ?? ''}
                className="field"
                placeholder="CRUD"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                ชื่องาน *
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={activity?.name ?? ''}
                className="field"
                placeholder="List / Search"
              />
            </div>
            <div>
              <label className="label" htmlFor="countUnit">
                หน่วยนับ *
              </label>
              <input
                id="countUnit"
                name="countUnit"
                required
                list="count-units"
                defaultValue={activity?.countUnit ?? 'ต่อรายการ'}
                className="field"
                placeholder="ต่อหน้าจอ"
              />
              <datalist id="count-units">
                {countUnits.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-muted">
                ค่า MD ในแถวนี้คิดต่อหนึ่งอะไร — ใช้{' '}
                <span className="font-medium">{ONCE_PER_PROJECT_UNIT}</span>{' '}
                ถ้านับครั้งเดียวต่อโครงการ (ระบบจะล็อกจำนวนไว้ที่ 1)
              </p>
            </div>

            <div>
              <label className="label" htmlFor="unit">
                หน่วยผลลัพธ์
              </label>
              <input
                id="unit"
                name="unit"
                defaultValue={activity?.unit ?? 'MD'}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="sortOrder">
                ลำดับ
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                step="1"
                defaultValue={activity?.sortOrder ?? 0}
                className="field tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                หมายเหตุ / ที่มาของค่า
              </label>
              <input
                id="notes"
                name="notes"
                defaultValue={activity?.notes ?? ''}
                className="field"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={activity?.active ?? true}
              className="size-4 rounded border-line"
            />
            เปิดใช้งาน (ให้เลือกได้ในหน้า key รายการ)
          </label>
        </fieldset>

        <fieldset disabled={readOnly} className="card p-5">
          <legend className="px-1 text-sm font-semibold">
            ค่า Man-day ต่อบทบาท × ระดับความซับซ้อน
          </legend>
          <p className="mb-3 text-xs text-muted">
            ปล่อยเป็น 0 สำหรับบทบาทที่ไม่เกี่ยวข้องกับงานนี้
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-soft/50 text-xs">
                  <th className="border-b border-line px-3 py-2 text-left font-semibold">
                    บทบาท
                  </th>
                  {COMPLEXITIES.map((c) => (
                    <th
                      key={c}
                      className="w-28 border-b border-line px-3 py-2 text-center font-semibold"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-1.5">
                      {role.name}
                      {role.stackMultiplied ? (
                        <span className="chip ml-2 bg-accent/10 text-accent">
                          × stack
                        </span>
                      ) : null}
                    </td>
                    {COMPLEXITIES.map((c) => (
                      <td key={c} className="px-2 py-1.5">
                        <input
                          name={`cell_${role.id}_${c}`}
                          type="number"
                          step="0.5"
                          min="0"
                          defaultValue={cells[`${role.id}_${c}`] ?? 0}
                          aria-label={`${role.name} ${c}`}
                          className="field text-center tabular-nums"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        {state.error ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        {readOnly ? (
          <Link href="/matrix" className="btn-ghost">
            กลับ
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <SaveButton label={activity ? 'บันทึกการแก้ไข' : 'เพิ่ม Activity'} />
            <Link href="/matrix" className="btn-ghost">
              ยกเลิก
            </Link>
          </div>
        )}
      </form>

      {activity && !readOnly ? (
        <form
          action={deleteActivity}
          onSubmit={(event) => {
            if (!confirm(`ลบ "${activity.code} ${activity.name}" ใช่หรือไม่?`)) {
              event.preventDefault()
            }
          }}
          className="card flex flex-wrap items-center justify-between gap-3 border-danger/30 p-4"
        >
          <input type="hidden" name="id" value={activity.id} />
          <p className="text-sm text-muted">
            ลบ Activity นี้พร้อมค่า MD ทั้งหมด — รายการในโครงการที่อ้างอิงอยู่จะยังคงค่า
            MD ที่บันทึกไว้แล้ว
          </p>
          <button type="submit" className="btn-danger">
            ลบ Activity
          </button>
        </form>
      ) : null}
    </div>
  )
}
