import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { LogoutIcon } from '@/components/icons'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AppShell
      account={
        <Suspense fallback={<div className="h-10 w-10 rounded-full bg-surface-container" />}>
          <AccountMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}

/** proxy.ts đã chặn người chưa đăng nhập — đây là lớp kiểm tra thứ hai. */
async function AccountMenu() {
  if (!isSupabaseConfigured) {
    redirect('/login')
  }

  // getClaims() kiểm tra hạn token bằng giờ hiện tại → chỉ chạy lúc request
  await connection()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    redirect('/login')
  }

  const email = typeof data.claims.email === 'string' ? data.claims.email : null

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-2">
      {email ? (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-container font-serif text-base font-semibold text-primary uppercase ring-2 ring-surface-container-lowest"
          title={email}
          aria-label={email}
        >
          {email[0]}
        </span>
      ) : null}
      {email ? (
        <span className="hidden max-w-44 truncate text-sm text-on-surface-variant xl:inline">{email}</span>
      ) : null}
      <button type="submit" className="btn-icon" aria-label="Đăng xuất" title="Đăng xuất">
        <LogoutIcon />
      </button>
    </form>
  )
}
