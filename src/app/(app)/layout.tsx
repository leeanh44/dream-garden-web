import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AppShell
      account={
        <Suspense fallback={<div className="h-10 w-24" />}>
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

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    redirect('/login')
  }

  const email = typeof data.claims.email === 'string' ? data.claims.email : null

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-3">
      {email ? (
        <span className="hidden max-w-48 truncate text-sm text-on-surface-variant lg:inline">{email}</span>
      ) : null}
      <button type="submit" className="btn-ghost">
        Đăng xuất
      </button>
    </form>
  )
}
