'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { saveItem, type ActionState } from '@/lib/actions/project'
import { ONCE_PER_PROJECT_UNIT, type Activity } from '@/lib/db/schema'
import { STANDARD } from '@/lib/standard'

const GRID_CLASS =
  'grid gap-2 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_80px_90px_auto]'

const COMPLEXITY_HINT = STANDARD.complexityLegend
  .map((level) => `${level.label}: ${level.description}`)
  .join('\n')

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary h-9 text-xs" disabled={pending}>
      {pending ? 'กำลังเพิ่ม...' : '+ เพิ่มรายการ'}
    </button>
  )
}

/**
 * The fields of one blank row. Remounted after every successful add (see the
 * `key` below), which clears both the inputs and the selected activity without
 * an effect.
 */
/** The five column headings of the keying row, with their hint text. */
const FIELD_HINTS = [
  { label: 'Details *', hint: 'รายละเอียดงานที่จะไปอยู่ในคอลัมน์ Details ของไฟล์ export' },
  {
    label: 'Activity',
    hint: 'แถวใน Standard Matrix ที่ใช้เป็นฐานคิดค่า MD — ถ้าไม่เลือก ต้องกรอก MD เอง',
  },
  { label: 'ระดับ', hint: 'ระดับความซับซ้อน L / M / H ตามนิยามด้านล่าง' },
  {
    label: 'จำนวน',
    hint: 'จำนวนตามหน่วยนับของ Activity ที่เลือก เช่น 5 หน้าจอ หรือ 3 interface',
  },
] as const

function Fields({ activities }: { activities: Activity[] }) {
  const [activityId, setActivityId] = useState('')

  const selected = activities.find((a) => String(a.id) === activityId)
  const oncePerProject = selected?.countUnit === ONCE_PER_PROJECT_UNIT

  const grouped = Object.entries(
    activities.reduce<Record<string, Activity[]>>((acc, a) => {
      const key = a.groupName ?? 'อื่น ๆ'
      ;(acc[key] ??= []).push(a)
      return acc
    }, {}),
  )

  return (
    <>
      {/* Due Date Plan and Deliverables are not keyed yet; the export still
          carries those template columns, empty. */}
      <div className={`${GRID_CLASS} hidden lg:grid`}>
        {FIELD_HINTS.map((field) => (
          <span
            key={field.label}
            title={field.hint}
            className="cursor-help text-[11px] font-medium text-muted"
          >
            {field.label}
          </span>
        ))}
        <span />
      </div>

      <div className={GRID_CLASS}>
        <input
          name="detail"
          required
          placeholder="รายละเอียดงาน (Details) *"
          aria-label="รายละเอียดงาน"
          className="field h-9"
        />
        <select
          name="activityId"
          aria-label="Activity จาก Standard Matrix"
          className="field h-9"
          value={activityId}
          onChange={(event) => setActivityId(event.target.value)}
        >
          <option value="">— ไม่อ้างอิง Matrix —</option>
          {grouped.map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="complexity"
          defaultValue="M"
          aria-label="ระดับความซับซ้อน"
          title={COMPLEXITY_HINT}
          className="field h-9"
        >
          {STANDARD.complexityLegend.map((level) => (
            <option
              key={level.label}
              value={level.label.charAt(0)}
              title={level.description}
            >
              {level.label.charAt(0)}
            </option>
          ))}
        </select>
        <input
          name="qty"
          type="number"
          step="0.5"
          min="0"
          // A row counted once per project must not be multiplied.
          key={oncePerProject ? 'locked' : 'free'}
          defaultValue="1"
          readOnly={oncePerProject}
          aria-label={selected ? `จำนวน (${selected.countUnit})` : 'จำนวน'}
          title={
            oncePerProject
              ? 'แถวนี้นับครั้งเดียวต่อโครงการ จึงคูณจำนวนไม่ได้'
              : selected
                ? `จำนวน ${selected.countUnit}`
                : 'เลือก Activity ก่อน จะบอกว่านับต่อหน่วยอะไร'
          }
          className="field h-9 text-center tabular-nums"
        />
        <Submit />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {STANDARD.complexityLegend.map((level) => (
          <li key={level.label}>
            <span className="font-medium">{level.label}</span>{' '}
            {level.description.split(' — ')[0]}
          </li>
        ))}
      </ul>

      {selected ? (
        <p className="text-xs text-muted">
          <span className="font-medium">
            {selected.code} {selected.name}
          </span>{' '}
          — ค่า MD คิด{' '}
          <span className="font-medium">{selected.countUnit}</span>
          {oncePerProject ? ' จึงล็อกจำนวนไว้ที่ 1' : ''}
          {selected.notes ? ` · ${selected.notes}` : ''}
        </p>
      ) : null}
    </>
  )
}

export function AddItemForm({
  projectId,
  phaseId,
  activities,
}: {
  projectId: number
  phaseId: number
  activities: Activity[]
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveItem, {})

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="phaseId" value={phaseId} />

      {/* A fresh row after each add, so dozens of items can be keyed in a row. */}
      <Fields key={state.nonce ?? 0} activities={activities} />

      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
