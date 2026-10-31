'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { CubeIcon, LeafIcon, WalletIcon } from '@/components/icons'

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Giai đoạn sau — hiện mờ + badge "Sắp có" */
  comingSoon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Kho cây', icon: LeafIcon },
  { href: '/insights', label: 'Giao dịch', icon: WalletIcon, comingSoon: true },
  { href: '/planner', label: 'Vườn 3D', icon: CubeIcon, comingSoon: true },
]

const isActive = (pathname: string | null, href: string) =>
  pathname != null &&
  (href === '/' ? pathname === '/' || pathname.startsWith('/plants') : pathname.startsWith(href))

type MainNavProps = { variant: 'top' | 'bottom' }

/** Gọi không có `pathname` → tự đọc từ URL; `pathname={null}` dùng làm fallback khi prerender. */
export function MainNav(props: MainNavProps & { pathname?: string | null }) {
  return 'pathname' in props ? <NavList {...props} pathname={props.pathname ?? null} /> : <LiveNav {...props} />
}

function LiveNav(props: MainNavProps) {
  const pathname = usePathname()
  return <NavList {...props} pathname={pathname} />
}

function NavList({ variant, pathname }: MainNavProps & { pathname: string | null }) {
  const compact = variant === 'bottom'

  return (
    <nav
      className={
        compact
          ? 'fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 mx-auto flex max-w-md gap-1 rounded-full border border-white/60 bg-surface-container-lowest/85 p-1.5 shadow-leaf-lg backdrop-blur-xl backdrop-saturate-150 md:hidden'
          : 'hidden items-center gap-1 md:flex'
      }
      aria-label="Điều hướng chính"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} compact={compact} />
      ))}
    </nav>
  )
}

function NavLink({ item, active, compact }: { item: NavItem; active: boolean; compact: boolean }) {
  const Icon = item.icon
  const className = compact
    ? `flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[11px] leading-none font-semibold transition-colors ${
        active ? 'bg-secondary-container text-primary' : 'text-on-surface-variant'
      }`
    : `flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
        active ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:bg-surface-container'
      }`

  const content = (
    <>
      <Icon className={compact ? 'h-5 w-5' : 'h-4 w-4'} />
      <span>{item.label}</span>
      {item.comingSoon && !compact ? (
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] leading-none font-semibold text-outline">
          Sắp có
        </span>
      ) : null}
    </>
  )

  if (item.comingSoon) {
    return (
      <span className={`${className} cursor-not-allowed opacity-45`} aria-disabled="true" title="Sắp có">
        {content}
      </span>
    )
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  )
}
