import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/dal'
import { db } from '@/lib/db'
import { questionnaireActivities, questionnaires } from '@/lib/db/schema'

import { QuestionnaireCreateForm } from './create-form'

export const metadata = { title: 'Questionnaire | Manday Estimation' }

export default async function QuestionnairesPage() {
  const user = await requireUser()

  const rows = await db
    .select({
      id: questionnaires.id,
      name: questionnaires.name,
      description: questionnaires.description,
      active: questionnaires.active,
      topicCount: sql<number>`count(${questionnaireActivities.id})`,
    })
    .from(questionnaires)
    .leftJoin(
      questionnaireActivities,
      eq(questionnaireActivities.questionnaireId, questionnaires.id),
    )
    .groupBy(questionnaires.id)
    .orderBy(questionnaires.name)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Questionnaire</h1>
        <p className="mt-1 text-sm text-muted">
          ชุดคำถามแบบสำรวจตามหัวข้อ Standard Matrix — แต่ละหัวข้อกรอกจำนวนได้ทั้ง
          ระดับ L, M และ H พร้อมกัน แล้วสร้างรายการประเมินให้อัตโนมัติ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {rows.map((q) => (
            <Link
              key={q.id}
              href={`/questionnaires/${q.id}`}
              className="card block p-4 transition hover:border-brand/40 hover:bg-brand-soft/20"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{q.name}</h2>
                <span className="chip bg-brand-soft text-brand">
                  {q.topicCount} หัวข้อ
                </span>
                {q.active ? null : (
                  <span className="chip bg-danger/10 text-danger">ปิดใช้งาน</span>
                )}
              </div>
              {q.description ? (
                <p className="mt-1 text-sm text-muted">{q.description}</p>
              ) : null}
            </Link>
          ))}

          {rows.length === 0 ? (
            <div className="card p-10 text-center text-sm text-muted">
              ยังไม่มีชุดคำถาม
            </div>
          ) : null}
        </div>

        {user.role === 'admin' ? <QuestionnaireCreateForm /> : null}
      </div>
    </div>
  )
}
