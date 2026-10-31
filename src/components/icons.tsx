import type { SVGProps } from 'react'

/**
 * Icon SVG nội tuyến — thay emoji vì emoji lệch baseline / khác nhau giữa các hệ điều hành.
 * Mọi icon dùng `currentColor` và mặc định 1em, căn giữa trong flex container.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

const base = ({ size = '1em', className = '', ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  className: `shrink-0 ${className}`,
  ...props,
})

/** Chiếc lá của logo app (cùng path với `src/app/icon.svg`, viewBox 64). */
export const LEAF_PATH =
  'M46 14C28 14 16 24 16 40c0 3 .6 6 1.6 8.4C20 36 28 28 38 24 30 30 24 38 21 50c2.6 1.3 5.6 2 9 2 15 0 22-14 16-38z'

/** Lá đặc — dùng làm logo / nút thêm cây. */
export function LeafIcon({ size = '1em', className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="12 10 40 46"
      fill="currentColor"
      aria-hidden
      focusable={false}
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path d={LEAF_PATH} />
    </svg>
  )
}

/** Lá + dấu cộng nhỏ — nút "Thêm cây". */
export function LeafPlusIcon({ size = '1em', className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="8 8 50 50"
      aria-hidden
      focusable={false}
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path d={LEAF_PATH} fill="currentColor" />
      <circle cx="46" cy="46" r="10" fill="var(--color-primary-fixed)" stroke="var(--color-primary)" strokeWidth="3" />
      <path d="M46 41v10M41 46h10" stroke="var(--color-primary)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

/** Logo app: ô vuông bo góc + lá (giống favicon). */
export function AppLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable={false} className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id="dg-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#006a46" />
          <stop offset="1" stopColor="#003823" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#dg-logo-bg)" />
      <path d={LEAF_PATH} fill="#9ef4c6" />
    </svg>
  )
}

export const CameraIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 10.6 3.5h2.8a1.5 1.5 0 0 1 1.3.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
)

export const FilmIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" />
  </svg>
)

export const SearchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

export const ArrowLeftIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
)

export const StarIcon = (props: IconProps) => (
  <svg {...base({ ...props, fill: 'currentColor', strokeWidth: 0 })}>
    <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
)

export const WalletIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16.5" height="11" rx="2.5" />
    <circle cx="16" cy="13.5" r="1.1" fill="currentColor" />
  </svg>
)

export const CubeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </svg>
)

export const PencilIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M9.5 7V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V7M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
  </svg>
)

export const DownloadIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </svg>
)

export const ShareIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
  </svg>
)

export const PlayIcon = (props: IconProps) => (
  <svg {...base({ ...props, fill: 'currentColor', strokeWidth: 0 })}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
)

export const PauseIcon = (props: IconProps) => (
  <svg {...base({ ...props, fill: 'currentColor', strokeWidth: 0 })}>
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
  </svg>
)

export const CheckIcon = (props: IconProps) => (
  <svg {...base({ ...props, strokeWidth: 2.6 })}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const SortIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
  </svg>
)

export const ClockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const SparkleIcon = (props: IconProps) => (
  <svg {...base({ ...props, fill: 'currentColor', strokeWidth: 0 })}>
    <path d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5zM19 15c.25 2 1.2 3 3 3.2-1.8.25-2.75 1.2-3 3.3-.25-2.1-1.2-3.05-3-3.3 1.8-.2 2.75-1.2 3-3.2z" />
  </svg>
)

export const LogoutIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 16l-4-4 4-4M6 12h10" />
  </svg>
)

export const AlertIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)

export const ImageIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.5-4.5L7 19.5" />
  </svg>
)
