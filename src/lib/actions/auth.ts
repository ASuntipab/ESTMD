'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { createSession, destroySession } from '@/lib/session'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  next: z.string().optional(),
})

export type LoginState = { error?: string }

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data
  const [user] = await db.select().from(users).where(eq(users.email, email))

  // One generic message: do not reveal whether the address exists.
  const invalid = { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
  if (!user || !user.active) return invalid
  if (!(await bcrypt.compare(password, user.passwordHash))) return invalid

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })

  // Only allow same-origin paths from the ?next parameter.
  const next = parsed.data.next
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
