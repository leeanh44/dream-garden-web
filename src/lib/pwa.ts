'use client'

import { useSyncExternalStore } from 'react'

/** Sự kiện `beforeinstallprompt` (Chrome/Edge/Android) — chưa có trong lib.dom. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = {
  /** Đang chạy như app đã cài (mở từ màn hình chính) */
  isStandalone: boolean
  /** iOS/iPadOS: không có nút cài, phải dùng Chia sẻ → Thêm vào MH chính */
  isIOS: boolean
  /** Trình duyệt cho phép hiện hộp thoại cài đặt */
  canPrompt: boolean
}

const SERVER_STATE: InstallState = { isStandalone: false, isIOS: false, canPrompt: false }

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
let state: InstallState = SERVER_STATE
const listeners = new Set<() => void>()

const computeState = (): InstallState => {
  const nav = navigator as Navigator & { standalone?: boolean }
  const isStandalone =
    installed || window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return { isStandalone, isIOS, canPrompt: deferredPrompt != null && !isStandalone }
}

const emit = () => {
  const next = computeState()
  if (
    next.isStandalone !== state.isStandalone ||
    next.isIOS !== state.isIOS ||
    next.canPrompt !== state.canPrompt
  ) {
    state = next
    listeners.forEach((listener) => listener())
  }
}

if (typeof window !== 'undefined') {
  // Bắt sự kiện càng sớm càng tốt — Chrome chỉ bắn 1 lần lúc tải trang
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    emit()
  })
  state = computeState()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const media = window.matchMedia('(display-mode: standalone)')
  media.addEventListener('change', emit)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', emit)
  }
}

export const useInstallState = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  )

/** Hiện hộp thoại cài đặt của trình duyệt. Trả về true nếu người dùng đồng ý. */
export const promptInstall = async () => {
  const event = deferredPrompt
  if (!event) {
    return false
  }
  deferredPrompt = null
  await event.prompt()
  const { outcome } = await event.userChoice
  emit()
  return outcome === 'accepted'
}

export const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return
  }
  // Đăng ký sau khi trang đã tải xong để không tranh băng thông với nội dung chính
  const register = () =>
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
