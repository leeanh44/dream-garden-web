'use client'

import { useState, useSyncExternalStore } from 'react'
import { LeafIcon } from '@/components/icons'
import { forgetSignedUrls } from '@/lib/photos'
import { usePhotoUrl } from '@/lib/queries'

/**
 * Ảnh trong bucket private — tự lấy signed URL (gom batch, cache bền 7 ngày).
 *
 * - `className` áp cho khung (kích thước, bo góc); ảnh luôn lấp đầy khung.
 * - `placeholderPath` (thumbnail ~30KB) hiện mờ ngay lập tức trong lúc ảnh nét đang tải.
 * - `priority` cho ảnh trên màn hình đầu tiên: tải ngay, ưu tiên cao.
 * - `deferFull`: hiện thumbnail (nét, không làm mờ) trước; ảnh full chỉ tải khi trang đã load xong
 *   và trình duyệt rảnh → ảnh full (vài trăm KB/ảnh) không giành băng thông lúc mở trang.
 */
export function PlantPhoto({
  path,
  placeholderPath,
  alt,
  className = '',
  fit = 'cover',
  priority = false,
  deferFull = false,
}: {
  path: string | null | undefined
  placeholderPath?: string | null
  alt: string
  className?: string
  fit?: 'cover' | 'contain'
  priority?: boolean
  deferFull?: boolean
}) {
  const isHydrated = useIsHydrated()
  const pageIdle = usePageIdle()
  const waitForIdle = deferFull && !pageIdle
  const full = usePhotoUrl(waitForIdle ? null : path)
  const placeholder = usePhotoUrl(placeholderPath && placeholderPath !== path ? placeholderPath : null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [retried, setRetried] = useState(false)

  const url = full.data
  const isLoaded = url != null && loadedSrc === url
  const hasFailed = !path || full.isError || (url != null && failedSrc === url && retried)
  // Thumbnail đang đóng vai ảnh chính (chờ ảnh full) → hiện nét thay vì làm mờ
  const sharpPlaceholder = deferFull && !url

  // HTML từ server chưa biết signed URL đã cache trong localStorage → frame hydrate luôn hiện skeleton
  // để khớp với server, ngay sau đó mới gắn ảnh.
  if (!isHydrated && path) {
    return (
      <div className={`relative overflow-hidden bg-surface-container ${className}`}>
        <div className="skeleton absolute inset-0" aria-hidden="true" />
      </div>
    )
  }

  if (hasFailed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-secondary-container/60 to-surface-container-low text-primary/30 ${className}`}
        role="img"
        aria-label={alt}
      >
        <LeafIcon size="34%" />
      </div>
    )
  }

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <div className={`relative overflow-hidden bg-surface-container ${className}`}>
      {!isLoaded ? (
        placeholder.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={placeholder.data}
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            className={`absolute inset-0 h-full w-full ${
              sharpPlaceholder ? fitClass : 'scale-110 object-cover blur-lg'
            }`}
          />
        ) : (
          <div className="skeleton absolute inset-0" aria-hidden="true" />
        )
      ) : null}

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          ref={(image) => {
            // Ảnh đã có trong HTTP cache → hiện luôn, không cần hiệu ứng mờ dần
            if (image?.complete && image.naturalWidth > 0 && loadedSrc !== url) {
              setLoadedSrc(url)
            }
          }}
          src={url}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoadedSrc(url)}
          onError={() => {
            setFailedSrc(url)
            if (!retried && path) {
              // URL có thể đã bị thu hồi / hết hạn → xin URL mới một lần
              setRetried(true)
              forgetSignedUrls([path])
              full.refetch()
            }
          }}
          className={`absolute inset-0 h-full w-full ${fitClass} transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trang đã tải xong (sự kiện `load`) + trình duyệt rảnh — dùng chung cho mọi ảnh `deferFull`
// ---------------------------------------------------------------------------

let pageIdle = false
let idleScheduled = false
const idleListeners = new Set<() => void>()

const markPageIdle = () => {
  pageIdle = true
  idleListeners.forEach((listener) => listener())
}

const schedulePageIdle = () => {
  if (idleScheduled) {
    return
  }
  idleScheduled = true
  const afterLoad = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(markPageIdle, { timeout: 3000 })
    } else {
      setTimeout(markPageIdle, 500)
    }
  }
  if (document.readyState === 'complete') {
    afterLoad()
  } else {
    window.addEventListener('load', afterLoad, { once: true })
  }
}

const subscribePageIdle = (listener: () => void) => {
  idleListeners.add(listener)
  schedulePageIdle()
  return () => {
    idleListeners.delete(listener)
  }
}

const noopSubscribe = () => () => {}

const useIsHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

const usePageIdle = () =>
  useSyncExternalStore(
    subscribePageIdle,
    () => pageIdle,
    () => false,
  )
