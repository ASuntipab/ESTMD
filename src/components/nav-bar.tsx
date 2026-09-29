'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { logout } from '@/lib/actions/auth'
import type { SessionPayload } from '@/lib/session'

const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/projects', label: 'โครงการ' },
  { href: '/matrix', label: 'Standard Matrix' },
  { href: '/questionnaires', label: 'Questionnaire' },
]

export function NavBar({ user }: { user: SessionPayload }) {
  const pathname = usePathname()

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/projects" className="shrink-0 leading-tight">
          <span className="block text-[10px] font-semibold tracking-[0.18em] text-accent">
            PTT DIGITAL
          </span>
          <span className="block text-sm font-semibold">Manday Estimation</span>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {LINKS.filter((l) => !l.adminOnly || user.role === 'admin').map(
            (link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-brand-soft text-brand'
                      : 'text-muted hover:bg-background hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              )
            },
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-right text-xs leading-tight">
            <span className="block font-medium">{user.name}</span>
            <span className="block text-muted">{user.role}</span>
          </span>
          <form action={logout}>
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
