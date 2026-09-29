'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveStackModifier,
  saveTechStack,
  type ActionState,
} from '@/lib/actions/matrix'

const COPY = {
  stack: {
    heading: 'เพิ่ม Technology Stack',
    button: 'เพิ่ม Stack',
    placeholder: 'เช่น Flutter',
    action: saveTechStack,
  },
  modifier: {
    heading: 'เพิ่มตัวปรับ',
    button: 'เพิ่มตัวปรับ',
    placeholder: 'เช่น รองรับหลายภาษา (i18n)',
    action: saveStackModifier,
  },
} as const

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : label}
    </button>
  )
}

export function MultiplierForm({ kind }: { kind: keyof typeof COPY }) {
  const copy = COPY[kind]
  const [state, formAction] = useActionState<ActionState, FormData>(
    copy.action,
    {},
  )

  return (
    <form action={formAction} className="card h-fit space-y-3 p-5">
      <h3 className="text-sm font-semibold">{copy.heading}</h3>

      <div>
        <label className="label" htmlFor={`${kind}-name`}>
          ชื่อ *
        </label>
        <input
          id={`${kind}-name`}
          name="name"
          required
          placeholder={copy.placeholder}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-multiplier`}>
          ตัวคูณ *
        </label>
        <input
          id={`${kind}-multiplier`}
          name="multiplier"
          type="number"
          step="0.05"
          min="0.1"
          defaultValue="1"
          required
          className="field tabular-nums"
        />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-note`}>
          หมายเหตุ
        </label>
        <input id={`${kind}-note`} name="note" className="field" />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-sort`}>
          ลำดับ
        </label>
        <input
          id={`${kind}-sort`}
          name="sortOrder"
          type="number"
          step="10"
          defaultValue="0"
          className="field tabular-nums"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}

      <Submit label={copy.button} />
    </form>
  )
}
