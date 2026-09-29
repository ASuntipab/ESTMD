import { requireUser } from '@/lib/dal'

import { NavBar } from '@/components/nav-bar'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted sm:px-6">
        อ้างอิง MD_Standard_Matrix.xlsx · export ตาม template
        PTT-PSSR-Online_Manday.xlsx
      </footer>
    </>
  )
}
