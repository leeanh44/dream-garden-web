'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { AppLogo, CloseIcon, DownloadIcon, ShareIcon } from '@/components/icons'
import { Modal } from '@/components/modal'
import { promptInstall, useInstallState } from '@/lib/pwa'

const DISMISS_KEY = 'dg.installDismissedAt'
/** Ẩn lời mời 14 ngày sau khi người dùng bấm đóng */
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000

const dismissListeners = new Set<() => void>()
const readDismissed = () => {
  try {
    return Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS
  } catch {
    return false
  }
}
const subscribeDismissed = (listener: () => void) => {
  dismissListeners.add(listener)
  return () => dismissListeners.delete(listener)
}

/** Lời mời cài app lên màn hình chính (ẩn khi đã cài / trình duyệt không hỗ trợ). */
export function InstallBanner() {
  const { isStandalone, isIOS, canPrompt } = useInstallState()
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true)
  const [showGuide, setShowGuide] = useState(false)

  if (isStandalone || dismissed || (!canPrompt && !isIOS)) {
    return null
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // bỏ qua
    }
    dismissListeners.forEach((listener) => listener())
  }

  return (
    <>
      <div className="mb-8 flex animate-fade-up items-center gap-3 rounded-3xl bg-surface-container-lowest p-3 pr-2 shadow-leaf ring-1 ring-surface-container-high/60 sm:gap-4 sm:p-4">
        <AppLogo className="h-12 w-12 drop-shadow-[0_6px_12px_rgba(0,79,51,0.3)]" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base leading-tight font-semibold text-on-surface">Cài Dream&apos;s Garden lên điện thoại</p>
          <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
            Mở toàn màn hình từ màn hình chính, ghi nhận ảnh lá chỉ với một chạm.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (canPrompt ? promptInstall() : setShowGuide(true))}
          className="btn-primary min-h-10 px-4 text-sm"
        >
          <DownloadIcon /> Cài đặt
        </button>
        <button type="button" onClick={dismiss} className="btn-icon -ml-1" aria-label="Để sau" title="Để sau">
          <CloseIcon />
        </button>
      </div>

      <Modal open={showGuide} onClose={() => setShowGuide(false)} title="Thêm vào màn hình chính" icon={<DownloadIcon />}>
        <ol className="space-y-3 text-sm text-on-surface">
          <GuideStep step={1}>
            Mở trang này bằng <strong>Safari</strong>, bấm nút <strong>Chia sẻ</strong>{' '}
            <ShareIcon className="inline align-[-0.15em] text-primary" /> ở thanh công cụ.
          </GuideStep>
          <GuideStep step={2}>
            Kéo xuống, chọn <strong>Thêm vào MH chính</strong> (Add to Home Screen).
          </GuideStep>
          <GuideStep step={3}>
            Bấm <strong>Thêm</strong>. Biểu tượng chiếc lá sẽ xuất hiện trên màn hình chính — mở từ đó để dùng như ứng dụng.
          </GuideStep>
        </ol>
        <button type="button" onClick={() => setShowGuide(false)} className="btn-secondary mt-6 w-full">
          Đã hiểu
        </button>
      </Modal>
    </>
  )
}

function GuideStep({ step, children }: { step: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-surface-container-low p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
        {step}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
