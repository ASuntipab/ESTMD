import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireUser } from '@/lib/dal'
import { listCountUnits, listRoles } from '@/lib/queries'

import { ActivityForm } from '../activity-form'

export const metadata = { title: 'เพิ่ม Activity | Standard Matrix' }

export default async function NewActivityPage() {
  const user = await requireUser()
  if (user.role !== 'admin') notFound()

  const [roles, countUnits] = await Promise.all([
    listRoles(),
    listCountUnits(),
  ])

  return (
    <div className="space-y-4">
      <nav className="text-sm text-muted">
        <Link href="/matrix" className="hover:underline">
          Standard Matrix
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">เพิ่ม Activity</span>
      </nav>
      <h1 className="text-xl font-semibold">เพิ่ม Activity</h1>
      <ActivityForm
        activity={null}
        roles={roles}
        countUnits={countUnits}
        cells={{}}
        readOnly={false}
      />
    </div>
  )
}
