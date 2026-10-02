import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/dal'

export async function GET() {
  await requireUser()

  const dbPath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATABASE_PATH ?? './data/estmanday.db',
  )

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(dbPath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `estmanday-backup-${timestamp}.db`

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/x-sqlite3',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
