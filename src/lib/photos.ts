import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const PHOTOS_BUCKET = 'plant-photos'

const FULL_MAX_SIZE = 2048
const THUMB_MAX_SIZE = 480
const SIGNED_URL_TTL_SECONDS = 60 * 60
/** Làm mới URL trước khi hết hạn 10 phút. */
export const SIGNED_URL_STALE_MS = (SIGNED_URL_TTL_SECONDS - 10 * 60) * 1000

// ---------------------------------------------------------------------------
// EXIF — ngày chụp
// ---------------------------------------------------------------------------

const isValidDate = (date: Date) => !Number.isNaN(date.getTime()) && date.getFullYear() > 1990

/** Ngày chụp theo EXIF; fallback `lastModified` của file. */
export const readCaptureDate = async (file: File): Promise<Date> => {
  try {
    const { parse } = await import('exifr')
    const exif = await parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate'])
    const candidate = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (candidate instanceof Date && isValidDate(candidate)) {
      return candidate
    }
  } catch {
    // Ảnh không có EXIF / định dạng không hỗ trợ
  }

  const fallback = new Date(file.lastModified)
  return isValidDate(fallback) ? fallback : new Date()
}

// ---------------------------------------------------------------------------
// Resize → JPEG
// ---------------------------------------------------------------------------

const resizeToJpeg = async (bitmap: ImageBitmap, maxSize: number, quality: number) => {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Trình duyệt không hỗ trợ canvas.')
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không nén được ảnh.'))),
      'image/jpeg',
      quality,
    )
  })
}

export type PreparedPhoto = {
  full: Blob
  thumb: Blob
  takenAt: Date
}

/** Đọc ngày chụp + tạo bản full (≤2048px) và thumbnail (≤480px). */
export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  const [takenAt, bitmap] = await Promise.all([
    readCaptureDate(file),
    createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
      throw new Error(`Không đọc được ảnh "${file.name}". Hãy dùng JPEG/PNG/WebP.`)
    }),
  ])

  try {
    const [full, thumb] = await Promise.all([
      resizeToJpeg(bitmap, FULL_MAX_SIZE, 0.86),
      resizeToJpeg(bitmap, THUMB_MAX_SIZE, 0.8),
    ])
    return { full, thumb, takenAt }
  } finally {
    bitmap.close()
  }
}

// ---------------------------------------------------------------------------
// Signed URL — gom nhiều path trong cùng tick thành 1 request
// ---------------------------------------------------------------------------

type PendingRequest = {
  resolve: (url: string) => void
  reject: (error: Error) => void
}

let pending = new Map<string, PendingRequest[]>()
let flushScheduled = false

const flushSignedUrlRequests = async () => {
  const batch = pending
  pending = new Map()
  flushScheduled = false

  const paths = [...batch.keys()]
  const { data, error } = await getSupabaseBrowserClient()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  for (const path of paths) {
    const waiters = batch.get(path) ?? []
    const signedUrl = data?.find((item) => item.path === path)?.signedUrl
    for (const waiter of waiters) {
      if (signedUrl) {
        waiter.resolve(signedUrl)
      } else {
        waiter.reject(new Error(error?.message ?? `Không lấy được ảnh ${path}`))
      }
    }
  }
}

export const getSignedPhotoUrl = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const waiters = pending.get(path) ?? []
    waiters.push({ resolve, reject })
    pending.set(path, waiters)

    if (!flushScheduled) {
      flushScheduled = true
      setTimeout(flushSignedUrlRequests, 0)
    }
  })
