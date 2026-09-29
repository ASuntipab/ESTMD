import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/dal'
import { workbookBuffer } from '@/lib/excel'
import { getProjectDetail } from '@/lib/queries'
import { buildSummary } from '@/lib/summary'

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/projects/[id]/export'>,
) {
  await requireUser()

  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const detail = await getProjectDetail(projectId)
  if (!detail) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const summary = buildSummary(detail)
  const buffer = await workbookBuffer(summary)

  // Keep the template's name as the stem so the file lands where the team expects.
  const stem = (detail.project.code || detail.project.name)
    .replace(/[\/:*?"<>|]/g, '-')
    .trim()
  const filename = `${stem}_Manday.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
