'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: string
  /** Giai đoạn sau — hiện mờ + badge "Sắp có" */
  comingSoon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Kho cây', icon: '🌿' },
  { href: '/insights', label: 'Giao dịch', icon: '💰', comingSoon: true },
  { href: '/planner', label: 'Vườn 3D', icon: '🧊', comingSoon: true },
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
          ? 'fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex justify-around rounded-full border border-surface-container-high bg-surface-container-lowest/95 p-1.5 shadow-leaf backdrop-blur md:hidden'
          : 'hidden flex-1 items-center gap-1 md:flex'
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
  const className = compact
    ? `flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold ${
        active ? 'bg-secondary-container text-primary' : 'text-on-surface-variant'
      }`
    : `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-secondary-container text-primary' : 'text-on-surface-variant hover:bg-surface-container'
      }`

  const content = (
    <>
      <span aria-hidden="true" className={compact ? 'text-lg leading-none' : ''}>
        {item.icon}
      </span>
      <span>{item.label}</span>
      {item.comingSoon && !compact ? (
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-outline">Sắp có</span>
      ) : null}
    </>
  )

  if (item.comingSoon) {
    return (
      <span className={`${className} cursor-not-allowed opacity-50`} aria-disabled="true" title="Sắp có">
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
