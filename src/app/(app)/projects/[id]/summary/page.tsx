import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SummaryView } from '@/components/summary-view'
import { requireUser } from '@/lib/dal'
import { getProjectDetail } from '@/lib/queries'
import { buildSummary } from '@/lib/summary'

export default async function ProjectSummaryPage({
  params,
}: PageProps<'/projects/[id]/summary'>) {
  await requireUser()
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) notFound()

  const detail = await getProjectDetail(projectId)
  if (!detail) notFound()

  const summary = buildSummary(detail)

  return (
    <div className="space-y-5">
      <nav className="text-sm text-muted">
        <Link href="/projects" className="hover:underline">
          โครงการ
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:underline">
          {detail.project.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">สรุป</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">สรุปการประเมิน Man-day</h1>
          <p className="mt-1 text-sm text-muted">{detail.project.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${projectId}?step=3`} className="btn-ghost">
            แก้ไขรายการ
          </Link>
          <a href={`/api/projects/${projectId}/export`} className="btn-primary">
            ⬇ Export Excel
          </a>
        </div>
      </div>

      <SummaryView summary={summary} />
    </div>
  )
}
