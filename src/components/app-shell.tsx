import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { MainNav } from '@/components/main-nav'
import { APP_NAME } from '@/lib/garden'

export function AppShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-surface-container-high bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="font-serif text-xl text-primary">{APP_NAME}</span>
          </Link>

          <Suspense fallback={<MainNav variant="top" pathname={null} />}>
            <MainNav variant="top" />
          </Suspense>

          <div className="ml-auto">{account}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:pb-12">{children}</main>

      <Suspense fallback={<MainNav variant="bottom" pathname={null} />}>
        <MainNav variant="bottom" />
      </Suspense>
    </div>
  )
}
