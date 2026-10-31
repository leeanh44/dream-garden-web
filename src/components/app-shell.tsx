import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { AppLogo } from '@/components/icons'
import { MainNav } from '@/components/main-nav'
import { APP_NAME } from '@/lib/garden'

export function AppShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-surface-container-high/70 bg-surface/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:gap-8">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${APP_NAME} — Kho cây`}>
            <AppLogo className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6" />
            <span className="font-serif text-xl leading-none font-semibold text-primary">{APP_NAME}</span>
          </Link>

          <Suspense fallback={<MainNav variant="top" pathname={null} />}>
            <MainNav variant="top" />
          </Suspense>

          <div className="ml-auto flex items-center">{account}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 md:pt-8 md:pb-16">{children}</main>

      <Suspense fallback={<MainNav variant="bottom" pathname={null} />}>
        <MainNav variant="bottom" />
      </Suspense>
    </div>
  )
}
