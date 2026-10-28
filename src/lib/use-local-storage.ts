'use client'

import { useCallback, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

const readValue = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Preference nhỏ lưu localStorage (sort, filter…) — an toàn khi SSR / private mode. */
export function useLocalStorageState<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readValue(key),
    () => null,
  )
  const value = raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Bỏ qua — chỉ là tiện ích
      }
      listeners.forEach((listener) => listener())
    },
    [key],
  )

  return [value, setValue] as const
}
