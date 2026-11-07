'use client'

import { useSyncExternalStore } from 'react'
import { THEME_COLORS, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePref } from '@/lib/theme'

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

const readPref = (): ThemePref => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

const readResolved = (): ResolvedTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

const applyTheme = (pref: ThemePref) => {
  const resolved: ResolvedTheme = pref === 'dark' || (pref === 'system' && systemPrefersDark()) ? 'dark' : 'light'
  document.documentElement.dataset.theme = resolved
  // Thẻ meta theme-color (mỗi chế độ hệ thống 1 thẻ): người dùng tự chọn → cả 2 theo lựa chọn đó
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const own: ResolvedTheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = THEME_COLORS[pref === 'system' ? own : resolved]
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (readPref() === 'system') {
      applyTheme('system')
      notify()
    }
  }
  // Tab khác đổi chế độ → tab này đổi theo
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(readPref())
      notify()
    }
  }
  media.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

export const setThemePref = (pref: ThemePref) => {
  try {
    if (pref === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, pref)
    }
  } catch {
    // Không lưu được (chế độ riêng tư) — vẫn đổi trong phiên hiện tại
  }
  applyTheme(pref)
  notify()
}

/** Lựa chọn của người dùng: 'light' | 'dark' | 'system'. */
export const useThemePref = () => useSyncExternalStore(subscribe, readPref, () => 'system' as const)

/** Chế độ đang hiển thị thực tế. */
export const useResolvedTheme = () => useSyncExternalStore(subscribe, readResolved, () => 'light' as const)
