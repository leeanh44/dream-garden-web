import { connection } from 'next/server'
import { Suspense } from 'react'
import { LoginForm } from './login-form'
import { AppLogo, LeafIcon } from '@/components/icons'
import { APP_NAME, pickRandomGardenSlogan } from '@/lib/garden'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const metadata = { title: `Đăng nhập · ${APP_NAME}` }

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <LeafIcon className="pointer-events-none absolute -top-16 -left-20 h-80 w-80 -rotate-[30deg] text-primary-fixed/40" />
      <LeafIcon className="pointer-events-none absolute -right-24 -bottom-20 h-96 w-96 rotate-[150deg] text-secondary-container/70" />
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <AppLogo priority className="mx-auto mb-5 h-24 w-24 animate-sway shadow-[0_16px_30px_-12px_rgba(0,79,51,0.45)]" />
          <h1 className="font-serif text-4xl font-semibold text-primary">{APP_NAME}</h1>
          <p className="mt-2 min-h-5 text-sm text-on-surface-variant">
            <Suspense>
              <Slogan />
            </Suspense>
          </p>
        </div>

        {isSupabaseConfigured ? (
          <Suspense fallback={<div className="card h-80 animate-pulse" />}>
            <LoginFormWithParams searchParams={searchParams} />
          </Suspense>
        ) : (
          <div className="rounded-3xl bg-error-container p-5 text-sm text-on-error-container">
            Chưa cấu hình Supabase. Hãy tạo file <code>.env.local</code> theo <code>.env.example</code> rồi
            chạy lại.
          </div>
        )}
      </div>
    </main>
  )
}

async function Slogan() {
  await connection()
  return pickRandomGardenSlogan()
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next, error } = await searchParams
  return (
    <LoginForm
      next={typeof next === 'string' ? next : undefined}
      initialError={error === 'callback' ? 'Link xác nhận không hợp lệ hoặc đã hết hạn.' : null}
    />
  )
}
