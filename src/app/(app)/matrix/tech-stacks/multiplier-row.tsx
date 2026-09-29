'use client'

import { useActionState } from 'react'

import {
  deleteStackModifier,
  deleteTechStack,
  saveStackModifier,
  saveTechStack,
  setMultiplierActive,
  type ActionState,
} from '@/lib/actions/matrix'

export type MultiplierRowData = {
  id: number
  name: string
  multiplier: number
  note: string | null
  sortOrder: number
  active: boolean
}

export const ROW_GRID =
  'grid items-center gap-2 lg:grid-cols-[minmax(0,1.5fr)_84px_minmax(0,1.5fr)_72px_150px]'

const ACTIONS = {
  stack: { save: saveTechStack, remove: deleteTechStack },
  modifier: { save: saveStackModifier, remove: deleteStackModifier },
} as const

export type MultiplierKind = keyof typeof ACTIONS

export function MultiplierRow({
  kind,
  row,
}: {
  kind: MultiplierKind
  row: MultiplierRowData
}) {
  const actions = ACTIONS[kind]
  const [saveState, saveAction] = useActionState<ActionState, FormData>(
    actions.save,
    {},
  )
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    actions.remove,
    {},
  )

  const message = saveState.error ?? removeState.error ?? removeState.ok

  return (
    <div
      className={`border-b border-line/70 px-3 py-2 last:border-0 ${
        row.active ? '' : 'bg-background/60'
      }`}
    >
      <div className={ROW_GRID}>
        <form
          action={saveAction}
          id={`save-${kind}-${row.id}`}
          className={`${ROW_GRID} col-span-4 lg:contents`}
        >
          <input type="hidden" name="id" value={row.id} />
          <input
            name="name"
            required
            defaultValue={row.name}
            aria-label="ชื่อรายการ"
            className="field h-8 text-sm"
          />
          <input
            name="multiplier"
            type="number"
            step="0.05"
            min="0.1"
            required
            defaultValue={row.multiplier}
            aria-label="ตัวคูณ"
            title="คูณค่า MD ของบทบาทที่ติดธง × stack"
            className="field h-8 text-center text-sm tabular-nums"
          />
          <input
            name="note"
            defaultValue={row.note ?? ''}
            aria-label="หมายเหตุ"
            placeholder="เหตุผลที่ใช้ตัวคูณนี้"
            className="field h-8 text-sm"
          />
          <input
            name="sortOrder"
            type="number"
            step="10"
            defaultValue={row.sortOrder}
            aria-label="ลำดับ"
            title="ลำดับการเรียง — เลขน้อยอยู่บน เพิ่มทีละ 10 เพื่อให้แทรกรายการใหม่ตรงกลางได้"
            className="field h-8 text-center text-sm tabular-nums"
          />
        </form>

        <div className="flex items-center justify-end gap-1">
          <button
            type="submit"
            form={`save-${kind}-${row.id}`}
            className="btn-ghost h-8 px-2 text-xs"
          >
            บันทึก
          </button>

          {row.active ? (
            <form
              action={removeAction}
              onSubmit={(event) => {
                if (!confirm(`ลบ "${row.name}" ใช่หรือไม่?`)) {
                  event.preventDefault()
                }
              }}
            >
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                className="px-1.5 text-xs font-medium text-danger hover:underline"
              >
                ลบ
              </button>
            </form>
          ) : (
            <form action={setMultiplierActive}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="active" value="1" />
              <button
                type="submit"
                className="px-1.5 text-xs font-medium text-accent hover:underline"
              >
                เปิดใช้งาน
              </button>
            </form>
          )}
        </div>
      </div>

      {!row.active ? (
        <p className="mt-1 text-xs text-muted">
          ปิดใช้งาน — ไม่แสดงในตัวเลือกของโครงการใหม่ แต่โครงการที่เลือกไว้แล้ว
          ยังอ้างอิงได้
        </p>
      ) : null}

      {message ? (
        <p
          role="alert"
          className={`mt-1 text-xs ${
            saveState.error ?? removeState.error ? 'text-danger' : 'text-ok'
          }`}
        >
          {message}
        </p>
      ) : null}
      {saveState.ok ? (
        <p className="mt-1 text-xs text-ok">{saveState.ok}</p>
      ) : null}
    </div>
  )
}
