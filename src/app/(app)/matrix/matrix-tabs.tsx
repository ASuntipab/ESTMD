import Link from 'next/link'

const TABS = [
  { key: 'activities', href: '/matrix', label: 'Activity & ค่า MD' },
  { key: 'tech-stacks', href: '/matrix/tech-stacks', label: 'ตัวคูณ & ตัวปรับ' },
  { key: 'roles', href: '/matrix/roles', label: 'บทบาท & อัตรา/MD' },
] as const

export function MatrixTabs({
  active,
  isAdmin,
}: {
  active: (typeof TABS)[number]['key']
  isAdmin: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-line">
      {TABS.filter((t) => isAdmin || t.key === 'activities').map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab.key === active
              ? 'border-brand text-brand'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
