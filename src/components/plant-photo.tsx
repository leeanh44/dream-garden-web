'use client'

import { useState } from 'react'
import { LeafIcon } from '@/components/icons'
import { forgetSignedUrls } from '@/lib/photos'
import { usePhotoUrl } from '@/lib/queries'

/**
 * Ảnh trong bucket private — tự lấy signed URL (gom batch, cache bền 7 ngày).
 *
 * - `className` áp cho khung (kích thước, bo góc); ảnh luôn lấp đầy khung.
 * - `placeholderPath` (thumbnail ~30KB) hiện mờ ngay lập tức trong lúc ảnh nét đang tải.
 * - `priority` cho ảnh trên màn hình đầu tiên: tải ngay, ưu tiên cao.
 */
export function PlantPhoto({
  path,
  placeholderPath,
  alt,
  className = '',
  fit = 'cover',
  priority = false,
}: {
  path: string | null | undefined
  placeholderPath?: string | null
  alt: string
  className?: string
  fit?: 'cover' | 'contain'
  priority?: boolean
}) {
  const full = usePhotoUrl(path)
  const placeholder = usePhotoUrl(placeholderPath && placeholderPath !== path ? placeholderPath : null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [retried, setRetried] = useState(false)

  const url = full.data
  const isLoaded = url != null && loadedSrc === url
  const hasFailed = !path || full.isError || (url != null && failedSrc === url && retried)

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
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg"
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
