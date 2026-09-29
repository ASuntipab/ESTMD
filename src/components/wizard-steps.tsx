import Link from 'next/link'

export const WIZARD_STEPS = [
  { step: 1, label: 'ข้อมูลโครงการ' },
  { step: 2, label: 'Questionnaire' },
  { step: 3, label: 'Key รายการ' },
  { step: 4, label: 'ทีม & อัตรา' },
  { step: 5, label: 'สรุป & Export' },
] as const

export function WizardSteps({
  current,
  projectId,
}: {
  current: number
  /** Omitted while the project does not exist yet; steps are not clickable then. */
  projectId?: number
}) {
  return (
    <ol className="card flex flex-wrap gap-1 p-1.5">
      {WIZARD_STEPS.map(({ step, label }) => {
        const state =
          step === current ? 'current' : step < current ? 'done' : 'todo'
        const className = `flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition ${
          state === 'current'
            ? 'bg-brand text-white'
            : state === 'done'
              ? 'text-brand hover:bg-brand-soft'
              : 'text-muted'
        }`
        const body = (
          <>
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                state === 'current'
                  ? 'bg-white/20'
                  : state === 'done'
                    ? 'bg-brand-soft text-brand'
                    : 'bg-background'
              }`}
            >
              {step}
            </span>
            <span className="truncate">{label}</span>
          </>
        )

        return (
          <li key={step} className="flex flex-1 basis-40">
            {projectId ? (
              <Link
                href={`/projects/${projectId}?step=${step}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className={className}
              >
                {body}
              </Link>
            ) : (
              <span className={className}>{body}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
