import { connection } from 'next/server'
import { Suspense } from 'react'
import { LoginForm } from './login-form'
import { APP_NAME, pickRandomGardenSlogan } from '@/lib/garden'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const metadata = { title: `Đăng nhập · ${APP_NAME}` }

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
          <h1 className="font-serif text-4xl text-primary">{APP_NAME}</h1>
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
