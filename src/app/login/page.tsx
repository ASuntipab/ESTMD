import { LoginForm } from './login-form'

export const metadata = { title: 'เข้าสู่ระบบ | Manday Estimation' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent">
            PTT DIGITAL
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Manday Estimation</h1>
          <p className="mt-1 text-sm text-muted">
            ประเมิน Man-day ตาม MD Estimation Standard Matrix
          </p>
        </div>

        <div className="card p-6 shadow-sm">
          <LoginForm next={typeof next === 'string' ? next : undefined} />
        </div>

        {process.env.NODE_ENV === 'development' ? (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            บัญชีตั้งต้นจาก seed (แสดงเฉพาะตอน dev):
            <br />
            admin@pttdigital.com / Admin@1234
            <br />
            estimator@pttdigital.com / Estimate@1234
          </p>
        ) : null}
      </div>
    </main>
  )
}
