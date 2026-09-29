import Link from 'next/link'
import { notFound } from 'next/navigation'

import { deleteQuestionnaire } from '@/lib/actions/questionnaire'
import { requireUser } from '@/lib/dal'
import { getQuestionnaire, listActivities } from '@/lib/queries'

import { QuestionnaireHeaderForm } from './header-form'
import { TopicPicker } from './topic-picker'

export default async function QuestionnaireDetailPage({
  params,
}: PageProps<'/questionnaires/[id]'>) {
  const user = await requireUser()
  const { id } = await params
  const qnId = Number(id)
  if (!Number.isInteger(qnId)) notFound()

  const [questionnaire, activities] = await Promise.all([
    getQuestionnaire(qnId),
    listActivities(),
  ])
  if (!questionnaire) notFound()

  const isAdmin = user.role === 'admin'

  return (
    <div className="space-y-5">
      <nav className="text-sm text-muted">
        <Link href="/questionnaires" className="hover:underline">
          Questionnaire
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{questionnaire.name}</span>
      </nav>

      <QuestionnaireHeaderForm
        questionnaire={questionnaire}
        readOnly={!isAdmin}
      />

      <TopicPicker
        questionnaireId={questionnaire.id}
        activities={activities.filter((a) => a.active)}
        selectedIds={questionnaire.topics.map((t) => t.activityId)}
        readOnly={!isAdmin}
      />

      {isAdmin ? (
        <form
          action={deleteQuestionnaire}
          className="card flex flex-wrap items-center justify-between gap-3 border-danger/30 p-4"
        >
          <input type="hidden" name="id" value={questionnaire.id} />
          <p className="text-sm text-muted">
            ลบชุดคำถามนี้พร้อมรายการหัวข้อ — จำนวนที่โครงการกรอกไว้แล้วจะยังอยู่
            เพราะผูกกับ Activity ไม่ได้ผูกกับชุดคำถาม
          </p>
          <button type="submit" className="btn-danger">
            ลบชุดคำถาม
          </button>
        </form>
      ) : null}
    </div>
  )
}
