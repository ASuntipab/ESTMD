import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireUser } from '@/lib/dal'
import {
  getActivity,
  getActivityCellMap,
  listCountUnits,
  listRoles,
} from '@/lib/queries'

import { ActivityForm } from '../activity-form'

export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<'/matrix/[id]'>) {
  const user = await requireUser()
  const { id } = await params
  const activityId = Number(id)
  if (!Number.isInteger(activityId)) notFound()

  const [activity, roles, countUnits, cells, query] = await Promise.all([
    getActivity(activityId),
    listRoles(),
    listCountUnits(),
    getActivityCellMap(activityId),
    searchParams,
  ])
  if (!activity) notFound()

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted">
        <Link href="/matrix" className="hover:underline">
          Standard Matrix
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">
          {activity.code} {activity.name}
        </span>
      </nav>
      <h1 className="text-xl font-semibold">
        {user.role === 'admin' ? 'แก้ไข Activity' : 'รายละเอียด Activity'}
      </h1>
      <ActivityForm
        activity={activity}
        roles={roles}
        countUnits={countUnits}
        cells={Object.fromEntries(cells)}
        readOnly={user.role !== 'admin'}
        saved={query.saved === '1'}
      />
    </div>
  )
}
