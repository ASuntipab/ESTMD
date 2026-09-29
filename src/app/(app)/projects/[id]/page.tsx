import Link from 'next/link'
import { notFound } from 'next/navigation'

import { setProjectStatus } from '@/lib/actions/project'
import { requireUser } from '@/lib/dal'
import {
  getProjectDetail,
  listActivities,
  listQuestionnaires,
  listStackModifiers,
  listTechStacks,
  type ProjectDetail,
} from '@/lib/queries'

import { WizardSteps } from '@/components/wizard-steps'
import { ProjectForm } from './project-form'
import { StepAnswers } from './step-answers'
import { StepItems } from './step-items'
import { StepTeam } from './step-team'
import { StepSummary } from './step-summary'

/** Active stacks, plus the project's own stack when that one is retired. */
async function stackOptions(detail: ProjectDetail) {
  const active = await listTechStacks()
  const current = detail.stack
  return current && !active.some((s) => s.id === current.id)
    ? [...active, current]
    : active
}

export default async function ProjectWizardPage({
  params,
  searchParams,
}: PageProps<'/projects/[id]'>) {
  const user = await requireUser()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) notFound()

  const detail = await getProjectDetail(projectId)
  if (!detail) notFound()

  const stepRaw = Number(query.step)
  const step = stepRaw >= 1 && stepRaw <= 5 ? stepRaw : detail.project.wizardStep
  const readOnly = user.role === 'viewer'

  return (
    <div className="space-y-5">
      <nav className="text-sm text-muted">
        <Link href="/projects" className="hover:underline">
          โครงการ
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{detail.project.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{detail.project.name}</h1>
        {readOnly ? null : (
          <form action={setProjectStatus} className="flex items-center gap-2">
            <input type="hidden" name="id" value={detail.project.id} />
            <label className="text-xs text-muted" htmlFor="status">
              สถานะ
            </label>
            <select
              id="status"
              name="status"
              defaultValue={detail.project.status}
              className="field h-9 w-36 text-sm"
            >
              <option value="draft">ร่าง</option>
              <option value="in_review">รอทบทวน</option>
              <option value="approved">อนุมัติแล้ว</option>
            </select>
            <button type="submit" className="btn-ghost h-9 text-xs">
              บันทึก
            </button>
          </form>
        )}
      </div>

      <WizardSteps current={step} projectId={detail.project.id} />

      {step === 1 ? (
        <ProjectForm
          project={detail.project}
          // A stack that has been retired must still appear while a project
          // points at it, or saving the form would silently clear the choice.
          techStacks={await stackOptions(detail)}
          modifiers={await listStackModifiers()}
          selectedModifierIds={detail.modifiers.map((m) => m.id)}
          questionnaires={await listQuestionnaires()}
          readOnly={readOnly}
        />
      ) : null}

      {step === 2 ? (
        <StepAnswers
          project={detail.project}
          questionnaire={detail.survey}
          quantities={Object.fromEntries(detail.activityQty)}
          readOnly={readOnly}
        />
      ) : null}

      {step === 3 ? (
        <StepItems
          detail={detail}
          activities={await listActivities()}
          readOnly={readOnly}
        />
      ) : null}

      {step === 4 ? <StepTeam detail={detail} readOnly={readOnly} /> : null}

      {step === 5 ? <StepSummary detail={detail} /> : null}
    </div>
  )
}
