'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveQuestionnaireTopics,
  type ActionState,
} from '@/lib/actions/questionnaire'
import type { Activity } from '@/lib/db/schema'

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : `บันทึก ${count} หัวข้อ`}
    </button>
  )
}

export function TopicPicker({
  questionnaireId,
  activities,
  selectedIds,
  readOnly,
}: {
  questionnaireId: number
  activities: Activity[]
  selectedIds: number[]
  readOnly: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveQuestionnaireTopics,
    {},
  )
  const [picked, setPicked] = useState(() => new Set(selectedIds))

  const groups = useMemo(() => {
    const byGroup = new Map<string, Activity[]>()
    for (const activity of activities) {
      const key = activity.groupName ?? 'หัวข้อเดี่ยว'
      const list = byGroup.get(key)
      if (list) list.push(activity)
      else byGroup.set(key, [activity])
    }
    return [...byGroup.entries()]
  }, [activities])

  const toggle = (id: number, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleGroup = (list: Activity[], on: boolean) => {
    setPicked((current) => {
      const next = new Set(current)
      for (const activity of list) {
        if (on) next.add(activity.id)
        else next.delete(activity.id)
      }
      return next
    })
  }

  return (
    <form action={formAction} className="card p-5">
      <input type="hidden" name="questionnaireId" value={questionnaireId} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="activityIds" value={id} />
      ))}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            หัวข้อที่จะถาม ({picked.size} / {activities.length})
          </h2>
          <p className="mt-1 text-sm text-muted">
            เลือกหัวข้อจาก Standard Matrix ที่เกี่ยวกับโครงการ — ตอนตอบ แต่ละ
            หัวข้อจะกรอกจำนวนได้ทั้งระดับ L, M และ H พร้อมกัน
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleGroup(activities, true)}
              className="btn-ghost text-xs"
            >
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => toggleGroup(activities, false)}
              className="btn-ghost text-xs"
            >
              ล้างทั้งหมด
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {groups.map(([group, list]) => {
          const allOn = list.every((a) => picked.has(a.id))
          return (
            <div key={group}>
              <div className="mb-1.5 flex items-center gap-2 border-b border-line pb-1">
                <h3 className="flex-1 text-xs font-semibold text-brand">
                  {group}
                </h3>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(list, !allOn)}
                    className="text-[11px] text-accent hover:underline"
                  >
                    {allOn ? 'ล้างกลุ่มนี้' : 'เลือกกลุ่มนี้'}
                  </button>
                )}
              </div>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((activity) => (
                  <label
                    key={activity.id}
                    title={activity.notes ?? undefined}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-brand-soft/30"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(activity.id)}
                      disabled={readOnly}
                      onChange={(event) =>
                        toggle(activity.id, event.target.checked)
                      }
                      className="mt-0.5 size-4 rounded border-line"
                    />
                    <span className="flex-1">
                      <span className="font-mono text-xs text-muted">
                        {activity.code}
                      </span>{' '}
                      {activity.name}
                      <span className="block text-[11px] text-muted">
                        {activity.countUnit}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="mt-3 text-sm text-ok">{state.ok}</p> : null}

      {readOnly ? null : (
        <div className="mt-4">
          <Submit count={picked.size} />
        </div>
      )}
    </form>
  )
}
