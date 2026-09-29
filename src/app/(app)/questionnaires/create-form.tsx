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
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'กำลังสร้าง...' : 'สร้างชุดคำถาม'}
    </button>
  )
}

export function QuestionnaireCreateForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveQuestionnaire,
    {},
  )

  return (
    <form action={formAction} className="card h-fit space-y-3 p-5">
      <h2 className="text-sm font-semibold">สร้างชุดคำถามใหม่</h2>

      <div>
        <label className="label" htmlFor="qn-name">
          ชื่อชุดคำถาม *
        </label>
        <input id="qn-name" name="name" required className="field" />
      </div>

      <div>
        <label className="label" htmlFor="qn-desc">
          คำอธิบาย
        </label>
        <textarea id="qn-desc" name="description" rows={3} className="field" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked
          className="size-4 rounded border-line"
        />
        เปิดใช้งาน
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  )
}
