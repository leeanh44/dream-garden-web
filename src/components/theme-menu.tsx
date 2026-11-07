'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { DeviceIcon, MoonIcon, SunIcon } from '@/components/icons'
import type { ThemePref } from '@/lib/theme'
import { setThemePref, useResolvedTheme, useThemePref } from '@/lib/use-theme'

const OPTIONS: { value: ThemePref; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Sáng', Icon: SunIcon },
  { value: 'dark', label: 'Tối', Icon: MoonIcon },
  { value: 'system', label: 'Theo máy', Icon: DeviceIcon },
]

/** Nút mặt trời / mặt trăng ở header → mở menu chọn Sáng / Tối / Theo máy. */
export function ThemeMenu() {
  const pref = useThemePref()
  const resolved = useResolvedTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const CurrentIcon = resolved === 'dark' ? MoonIcon : SunIcon

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn-icon ring-1 ring-outline-variant"
        aria-label="Chọn giao diện sáng / tối"
        title="Giao diện"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          role="radiogroup"
          aria-label="Giao diện"
          className="absolute top-full right-0 z-40 mt-2 flex w-44 animate-fade-in flex-col gap-1 rounded-3xl bg-surface-container-lowest p-1.5 shadow-leaf-lg ring-1 ring-outline-variant"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={pref === value}
              onClick={() => {
                setThemePref(value)
                setOpen(false)
              }}
              className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors ${
                pref === value ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              <Icon className="text-base" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
