'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { saveProject, type ActionState } from '@/lib/actions/project'
import type { Project, StackModifier, TechStack } from '@/lib/db/schema'
import { STANDARD } from '@/lib/standard'

function Submit({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending
        ? 'กำลังบันทึก...'
        : isNew
          ? 'สร้างและไปขั้นตอนถัดไป'
          : 'บันทึกและไปขั้นตอนถัดไป'}
    </button>
  )
}

export function ProjectForm({
  project,
  techStacks,
  modifiers,
  selectedModifierIds,
  questionnaires,
  readOnly = false,
}: {
  project: Project | null
  techStacks: TechStack[]
  modifiers: StackModifier[]
  selectedModifierIds: number[]
  questionnaires: { id: number; name: string; active: boolean }[]
  readOnly?: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveProject,
    {},
  )
  const defaultBufferPercent = STANDARD.defaultBufferPercent

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            ชื่อโครงการ *
          </label>
          <input
            id="name"
            name="name"
            required
            disabled={readOnly}
            defaultValue={project?.name ?? ''}
            placeholder="โครงการ PTT-PSSR Online"
            className="field text-base"
          />
        </div>

        <div>
          <label className="label" htmlFor="code">
            รหัสโครงการ
          </label>
          <input
            id="code"
            name="code"
            disabled={readOnly}
            defaultValue={project?.code ?? ''}
            className="field font-mono"
          />
        </div>

        <div>
          <label className="label" htmlFor="durationDays">
            ระยะเวลาโครงการ (วัน)
          </label>
          <input
            id="durationDays"
            name="durationDays"
            type="number"
            min="0"
            step="1"
            disabled={readOnly}
            defaultValue={project?.durationDays ?? ''}
            className="field tabular-nums"
          />
        </div>

        <div>
          <label className="label" htmlFor="techStackId">
            Technology Stack
          </label>
          <select
            id="techStackId"
            name="techStackId"
            disabled={readOnly}
            defaultValue={project?.techStackId ?? ''}
            className="field"
          >
            <option value="">— ไม่ใช้ตัวคูณ (×1) —</option>
            {techStacks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (×{s.multiplier}){s.active ? '' : ' — เลิกใช้แล้ว'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            คูณค่า MD ของ Developer / Developer (Senior) เท่านั้น
          </p>
        </div>

        <div className="sm:col-span-2">
          <span className="label">ตัวปรับ (เลือกได้หลายข้อ คูณทับกัน)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {modifiers.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-brand-soft/30"
              >
                <input
                  type="checkbox"
                  name="modifierIds"
                  value={m.id}
                  disabled={readOnly}
                  defaultChecked={selectedModifierIds.includes(m.id)}
                  className="mt-0.5 size-4 rounded border-line"
                />
                <span className="flex-1">
                  <span className="block font-medium">
                    {m.name} <span className="tabular-nums">×{m.multiplier}</span>
                  </span>
                  {m.note ? (
                    <span className="block text-xs text-muted">{m.note}</span>
                  ) : null}
                </span>
              </label>
            ))}
            {modifiers.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีตัวปรับในระบบ</p>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            ตัวคูณรวม = ตัวคูณ Stack × ตัวปรับทุกตัวที่เลือก — เปลี่ยนค่าแล้ว
            ระบบจะคำนวณ MD ของทุกรายการใหม่
          </p>
        </div>

        <div>
          <label className="label" htmlFor="bufferPercent">
            Buffer / Contingency (%)
          </label>
          <input
            id="bufferPercent"
            name="bufferPercent"
            type="number"
            min="0"
            max="100"
            step="1"
            disabled={readOnly}
            defaultValue={project?.bufferPercent ?? defaultBufferPercent}
            className="field tabular-nums"
          />
          <p className="mt-1 text-xs text-muted">
            บวกท้ายยอดค่าใช้จ่ายรวม — ค่ามาตรฐาน {defaultBufferPercent}% ตาม{' '}
            {STANDARD.source}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="questionnaireId">
            ชุดคำถาม (ถ้า requirement ยังไม่ชัด)
          </label>
          <select
            id="questionnaireId"
            name="questionnaireId"
            disabled={readOnly}
            defaultValue={project?.questionnaireId ?? ''}
            className="field"
          >
            <option value="">— ไม่ใช้ questionnaire —</option>
            {questionnaires
              .filter((q) => q.active)
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            ข้ามได้ถ้า requirement ชัดแล้วและต้องการ key รายการโดยตรง
          </p>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {readOnly ? null : <Submit isNew={!project} />}
    </form>
  )
}
