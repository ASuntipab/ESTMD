'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { generateItemsFromAnswers } from '@/lib/actions/project'
import {
  clearActivityQuantities,
  saveActivityQuantities,
  type ActionState,
} from '@/lib/actions/questionnaire'
import {
  COMPLEXITIES,
  ONCE_PER_PROJECT_UNIT,
  type Project,
} from '@/lib/db/schema'
import type { AnsweredCell } from '@/lib/queries'
import { STANDARD } from '@/lib/standard'

import { DetailDialog } from './detail-dialog'

type Topic = {
  id: number
  activityId: number
  helpText: string | null
  code: string
  name: string
  groupName: string | null
  countUnit: string
  notes: string | null
}

type Survey = {
  id: number
  name: string
  description: string | null
  topics: Topic[]
}

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_60px_60px_60px_36px_92px] items-center gap-2'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : 'บันทึกจำนวน'}
    </button>
  )
}

/**
 * The answer grid. Remounted by its key whenever the stored answers change, so
 * a save or a clear is always reflected rather than leaving stale numbers on
 * screen; between renders the typed values live here.
 */
function QuantityGrid({
  project,
  survey,
  quantities,
  readOnly,
  state,
  formAction,
}: {
  project: Project
  survey: Survey
  quantities: Record<string, AnsweredCell>
  readOnly: boolean
  state: ActionState
  formAction: (formData: FormData) => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(quantities).map(([key, cell]) => [key, String(cell.qty)]),
    ),
  )
  const [openTopic, setOpenTopic] = useState<Topic | null>(null)

  const groups = useMemo(() => {
    const byGroup = new Map<string, Topic[]>()
    for (const topic of survey.topics) {
      const key = topic.groupName ?? 'หัวข้อเดี่ยว'
      const list = byGroup.get(key)
      if (list) list.push(topic)
      else byGroup.set(key, [topic])
    }
    return [...byGroup.entries()]
  }, [survey.topics])

  const filledTopics = survey.topics.filter((topic) =>
    COMPLEXITIES.some((c) => Number(draft[`${topic.activityId}_${c}`]) > 0),
  ).length

  const totalQty = Object.values(draft).reduce(
    (sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)),
    0,
  )

  return (
    <>
      <form action={formAction} className="card overflow-hidden">
      <input type="hidden" name="projectId" value={project.id} />

      <div
        className={`${ROW_GRID} border-b border-line bg-brand-soft/60 px-4 py-2 text-xs font-semibold`}
      >
        <span>หัวข้อ</span>
        {STANDARD.complexityLegend.map((level) => (
          <span
            key={level.label}
            title={level.description}
            className="cursor-help text-center"
          >
            {level.label.charAt(0)}
          </span>
        ))}
        <span
          className="cursor-help text-center"
          title="แก้ข้อความ Details ที่จะไปแสดงในสรุปและไฟล์ Excel"
        >
          ✎
        </span>
        <span className="text-right">หน่วยนับ</span>
      </div>

      {groups.map(([group, topics]) => (
        <div key={group}>
          <p className="border-b border-line bg-background px-4 py-1.5 text-xs font-semibold text-brand">
            {group}
          </p>
          {topics.map((topic) => {
            const oncePerProject = topic.countUnit === ONCE_PER_PROJECT_UNIT
            const hasQty = COMPLEXITIES.some(
              (c) => Number(draft[`${topic.activityId}_${c}`]) > 0,
            )
            const editedCount = COMPLEXITIES.filter((c) =>
              quantities[`${topic.activityId}_${c}`]?.detail?.trim(),
            ).length
            return (
              <div
                key={topic.id}
                className={`${ROW_GRID} border-b border-line/70 px-4 py-1.5 last:border-0 hover:bg-brand-soft/20`}
              >
                <span className="text-sm">
                  <span className="font-mono text-xs text-muted">
                    {topic.code}
                  </span>{' '}
                  {topic.name}
                  {topic.helpText ? (
                    <span className="block text-[11px] text-muted">
                      {topic.helpText}
                    </span>
                  ) : null}
                </span>

                {COMPLEXITIES.map((complexity) => {
                  const key = `${topic.activityId}_${complexity}`
                  return (
                    <input
                      key={complexity}
                      name={`qty_${key}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      // Counts of screens, interfaces and the like are whole
                      // numbers; step 1 also makes the browser reject 2.5.
                      step="1"
                      max={oncePerProject ? '1' : undefined}
                      value={draft[key] ?? ''}
                      disabled={readOnly}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      aria-label={`${topic.code} ${topic.name} ระดับ ${complexity}`}
                      title={
                        oncePerProject
                          ? 'หัวข้อนี้นับครั้งเดียวต่อโครงการ กรอกได้สูงสุด 1'
                          : `จำนวน ${topic.countUnit} ที่ระดับ ${complexity}`
                      }
                      className="field h-8 px-1 text-center text-sm tabular-nums"
                    />
                  )
                })}

                {hasQty ? (
                  <button
                    type="button"
                    onClick={() => setOpenTopic(topic)}
                    title="แก้ข้อความ Details ที่จะไปแสดงในสรุปและไฟล์ Excel"
                    className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition ${
                      editedCount
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-line text-muted hover:border-brand/40 hover:text-brand'
                    }`}
                  >
                    {editedCount ? `✎ ${editedCount}` : '✎'}
                  </button>
                ) : (
                  <span />
                )}

                <span className="text-right text-[11px] text-muted">
                  {topic.countUnit}
                </span>
              </div>
            )
          })}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-background/60 p-4">
        <p className="text-sm text-muted">
          กรอกแล้ว{' '}
          <span className="font-medium text-foreground">{filledTopics}</span> /{' '}
          {survey.topics.length} หัวข้อ · รวม{' '}
          <span className="font-medium text-foreground tabular-nums">
            {totalQty}
          </span>{' '}
          หน่วย
        </p>
        <div className="flex items-center gap-3">
          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}
          {state.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}
          {readOnly ? null : <Submit />}
        </div>
      </div>
      </form>

      {openTopic ? (
        <DetailDialog
          key={openTopic.activityId}
          projectId={project.id}
          topic={openTopic}
          quantities={Object.fromEntries(
            COMPLEXITIES.map((c) => [
              c,
              draft[`${openTopic.activityId}_${c}`] ?? '',
            ]),
          )}
          details={Object.fromEntries(
            COMPLEXITIES.map((c) => [
              c,
              quantities[`${openTopic.activityId}_${c}`]?.detail ?? null,
            ]),
          )}
          readOnly={readOnly}
          onClose={() => setOpenTopic(null)}
        />
      ) : null}
    </>
  )
}

export function StepAnswers({
  project,
  questionnaire,
  quantities,
  readOnly,
}: {
  project: Project
  questionnaire: Survey | null
  /** `${activityId}_${complexity}` -> the saved answer. */
  quantities: Record<string, AnsweredCell>
  readOnly: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveActivityQuantities,
    {},
  )

  // Any change to the stored answers produces a different key, remounting the
  // grid so it shows the server's numbers and wordings.
  const dataKey = useMemo(
    () =>
      Object.entries(quantities)
        .map(([key, cell]) => `${key}=${cell.qty}:${cell.detail ?? ''}`)
        .sort()
        .join('|'),
    [quantities],
  )

  const answeredCount = Object.keys(quantities).length

  if (!questionnaire) {
    return (
      <div className="card space-y-3 p-8 text-center">
        <p className="text-sm text-muted">
          โครงการนี้ไม่ได้เลือกชุดคำถาม — ถ้ารู้รายการที่ต้องทำอยู่แล้ว ข้ามไป key
          รายการได้เลย
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/projects/${project.id}?step=1`} className="btn-ghost">
            เลือกชุดคำถาม
          </Link>
          <Link href={`/projects/${project.id}?step=3`} className="btn-primary">
            ข้ามไป key รายการ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-medium">{questionnaire.name}</h2>
        {questionnaire.description ? (
          <p className="mt-1 text-sm text-muted">{questionnaire.description}</p>
        ) : null}
        <ul className="mt-3 space-y-1 rounded-md bg-brand-soft/50 px-3 py-2 text-sm">
          <li>
            กรอก <span className="font-medium">จำนวน</span> ตามหน่วยนับของแต่ละ
            หัวข้อ เช่น 1.1 List / Search กรอก 3 = สามหน้าจอ
          </li>
          <li>
            หัวข้อเดียวกรอกได้ทั้ง <span className="font-medium">L, M, H</span>{' '}
            พร้อมกัน เช่น 3 หน้าจอง่าย + 2 ปานกลาง + 1 ซับซ้อน
          </li>
          <li>เว้นว่างหรือ 0 = ไม่มีงานนั้นในโครงการนี้</li>
        </ul>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {STANDARD.complexityLegend.map((level) => (
            <li key={level.label}>
              <span className="font-medium">{level.label}</span>{' '}
              {level.description.split(' — ')[0]}
            </li>
          ))}
        </ul>
      </div>

      <QuantityGrid
        key={dataKey}
        project={project}
        survey={questionnaire}
        quantities={quantities}
        readOnly={readOnly}
        state={state}
        formAction={formAction}
      />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-medium">สร้างรายการประเมินจากจำนวนที่กรอก</p>
          <p className="mt-1 text-sm text-muted">
            ระบบจะสร้างหนึ่งรายการต่อหนึ่งหัวข้อต่อหนึ่งระดับที่กรอกจำนวนไว้ (
            {answeredCount} ช่องพร้อมใช้) แล้วจัด phase ตามกลุ่มของหัวข้อ —
            รายการที่มีอยู่แล้วจะไม่ถูกสร้างซ้ำ และแก้ไขต่อได้ในขั้นตอนถัดไป
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readOnly ? null : (
            <>
              <form
                action={clearActivityQuantities}
                onSubmit={(event) => {
                  if (!confirm('ล้างจำนวนที่กรอกไว้ทั้งหมดใช่หรือไม่?')) {
                    event.preventDefault()
                  }
                }}
              >
                <input type="hidden" name="projectId" value={project.id} />
                <button type="submit" className="btn-ghost">
                  ล้างคำตอบ
                </button>
              </form>
              <form action={generateItemsFromAnswers}>
                <input type="hidden" name="projectId" value={project.id} />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={answeredCount === 0}
                >
                  สร้างรายการ
                </button>
              </form>
            </>
          )}
          <Link href={`/projects/${project.id}?step=3`} className="btn-ghost">
            ไป key รายการ
          </Link>
        </div>
      </div>
    </div>
  )
}
