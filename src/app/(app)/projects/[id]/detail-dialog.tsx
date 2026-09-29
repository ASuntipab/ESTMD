'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveActivityDetails,
  type ActionState,
} from '@/lib/actions/questionnaire'
import { COMPLEXITIES } from '@/lib/db/schema'
import { defaultItemDetail } from '@/lib/estimate'

export type DetailTopic = {
  activityId: number
  code: string
  name: string
  countUnit: string
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : 'บันทึกข้อความ'}
    </button>
  )
}

/**
 * Lets the estimator word the line items a topic will produce, one field per
 * complexity level that carries a quantity. The wording flows into the project
 * item when "สร้างรายการ" runs, and from there into the summary and the export.
 *
 * Rendered outside the quantity form on purpose: a form cannot be nested in
 * another form, and doing so breaks hydration and the inner submit.
 */
export function DetailDialog({
  projectId,
  topic,
  /** complexity -> the quantity currently typed in, as a string. */
  quantities,
  /** complexity -> the saved wording, if any. */
  details,
  readOnly,
  onClose,
}: {
  projectId: number
  topic: DetailTopic
  quantities: Record<string, string>
  details: Record<string, string | null>
  readOnly: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveActivityDetails,
    {},
  )

  const filled = COMPLEXITIES.filter(
    (complexity) => Number(quantities[complexity]) > 0,
  )

  // The dialog is mounted only while it should be showing.
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  // Close once a save comes back.
  useEffect(() => {
    if (state.nonce) ref.current?.close()
  }, [state.nonce])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,640px)] rounded-lg border border-line bg-surface p-0 text-foreground backdrop:bg-foreground/40"
    >
      <form action={formAction} className="space-y-4 p-5">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <h2 className="text-base font-semibold">
            <span className="font-mono text-sm text-muted">{topic.code}</span>{' '}
            {topic.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            ข้อความที่กรอกจะไปอยู่ในคอลัมน์{' '}
            <span className="font-medium">Details</span> ของหน้าสรุปและไฟล์ Excel
            — เว้นว่างไว้เพื่อใช้ข้อความอัตโนมัติ
          </p>
        </div>

        <div className="space-y-3">
          {filled.map((complexity) => {
            const qty = Number(quantities[complexity])
            return (
              <div key={complexity}>
                <label
                  className="label"
                  htmlFor={`detail-${topic.activityId}-${complexity}`}
                >
                  ระดับ {complexity} · {qty} {topic.countUnit}
                </label>
                <input
                  id={`detail-${topic.activityId}-${complexity}`}
                  name={`detail_${topic.activityId}_${complexity}`}
                  defaultValue={details[complexity] ?? ''}
                  placeholder={defaultItemDetail(
                    topic.name,
                    topic.countUnit,
                    qty,
                  )}
                  disabled={readOnly}
                  className="field"
                />
              </div>
            )
          })}
          {filled.length === 0 ? (
            <p className="text-sm text-muted">
              ยังไม่ได้กรอกจำนวนของหัวข้อนี้ — กรอกจำนวนแล้วกด “บันทึกจำนวน”
              ก่อนจึงจะแก้ข้อความได้
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <p className="rounded-md bg-brand-soft/50 px-3 py-2 text-xs text-muted">
          ข้อความจะไปถึงไฟล์ Excel เมื่อกด “สร้างรายการ” — ถ้าสร้างรายการไปแล้ว
          กดอีกครั้งเพื่ออัปเดตข้อความของรายการเดิม
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="btn-ghost"
          >
            ปิด
          </button>
          {readOnly || filled.length === 0 ? null : <Submit />}
        </div>
      </form>
    </dialog>
  )
}
