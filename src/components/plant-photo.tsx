'use client'

import { usePhotoUrl } from '@/lib/queries'

/** Ảnh trong bucket private — tự lấy signed URL (gom batch, cache ~50 phút). */
export function PlantPhoto({
  path,
  alt,
  className = '',
  loading = 'lazy',
}: {
  path: string | null | undefined
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const { data: url, isError } = usePhotoUrl(path)

  if (!path || isError) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-low text-2xl ${className}`}
        aria-label={alt}
        role="img"
      >
        🍃
      </div>
    )
  }

  if (!url) {
    return <div className={`animate-pulse bg-surface-container ${className}`} aria-hidden="true" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading={loading} decoding="async" className={className} />
}
