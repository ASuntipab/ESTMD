'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveQuestionnaire,
  type ActionState,
} from '@/lib/actions/questionnaire'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : 'บันทึก'}
    </button>
  )
}

export function QuestionnaireHeaderForm({
  questionnaire,
  readOnly,
}: {
  questionnaire: { id: number; name: string; description: string | null; active: boolean }
  readOnly: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveQuestionnaire,
    {},
  )

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <input type="hidden" name="id" value={questionnaire.id} />

      <div>
        <label className="label" htmlFor="qn-name">
          ชื่อชุดคำถาม *
        </label>
        <input
          id="qn-name"
          name="name"
          required
          disabled={readOnly}
          defaultValue={questionnaire.name}
          className="field text-base font-medium"
        />
      </div>

      <div>
        <label className="label" htmlFor="qn-desc">
          คำอธิบาย
        </label>
        <textarea
          id="qn-desc"
          name="description"
          rows={2}
          disabled={readOnly}
          defaultValue={questionnaire.description ?? ''}
          className="field"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          disabled={readOnly}
          defaultChecked={questionnaire.active}
          className="size-4 rounded border-line"
        />
        เปิดใช้งาน
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}

      {readOnly ? null : <Submit />}
    </form>
  )
}
