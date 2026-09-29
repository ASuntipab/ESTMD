import 'server-only'

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'estmanday_session'
const MAX_AGE_SECONDS = 60 * 60 * 8

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (see .env.example)')
  }
  return new TextEncoder().encode(value)
}

export type SessionPayload = {
  userId: number
  email: string
  name: string
  role: 'admin' | 'estimator' | 'viewer'
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function decrypt(token?: string): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(payload: SessionPayload) {
  const store = await cookies()
  store.set(COOKIE, await encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function readSession() {
  const store = await cookies()
  return decrypt(store.get(COOKIE)?.value)
}

export const SESSION_COOKIE = COOKIE
