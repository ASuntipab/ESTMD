import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { readSession, type SessionPayload } from './session'

/** The signed-in user, or a redirect to /login. Use this in every protected read. */
export const requireUser = cache(async (): Promise<SessionPayload> => {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
})

/** The signed-in user, or null. For the layout shell and optional rendering. */
export const currentUser = cache(async () => readSession())

/** Anything that mutates master data is admin-only. */
export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('ต้องมีสิทธิ์ admin เพื่อทำรายการนี้')
  }
  return user
}

/** Viewers can read everything but must not write. */
export async function requireWriter() {
  const user = await requireUser()
  if (user.role === 'viewer') {
    throw new Error('บัญชีนี้เป็นสิทธิ์ดูอย่างเดียว (viewer)')
  }
  return user
}
