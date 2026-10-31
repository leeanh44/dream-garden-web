import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const PHOTOS_BUCKET = 'plant-photos'

const FULL_MAX_SIZE = 2048
const THUMB_MAX_SIZE = 480
/**
 * Signed URL sống 7 ngày và được lưu lại (localStorage) → mở lại trang vẫn dùng đúng URL cũ,
 * trình duyệt lấy ảnh thẳng từ HTTP cache thay vì tải lại. Làm mới khi còn < 1 ngày.
 */
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60
const SIGNED_URL_MIN_REMAINING_MS = 24 * 60 * 60 * 1000
/** Thời gian TanStack Query coi URL là mới — URL luôn còn hạn ≥ 1 ngày khi được trả về. */
export const SIGNED_URL_STALE_MS = 60 * 60 * 1000
/** File ảnh có tên UUID, không bao giờ bị ghi đè → cache 1 năm. */
export const PHOTO_CACHE_CONTROL = '31536000'

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
// Signed URL — cache bền + gom nhiều path trong cùng tick thành 1 request
// ---------------------------------------------------------------------------

const URL_CACHE_KEY = 'dg.signedUrls.v1'
const URL_CACHE_MAX_ENTRIES = 1500

/** path → [signedUrl, hết hạn (ms)] */
type UrlCache = Map<string, [string, number]>

let urlCache: UrlCache | null = null

const getUrlCache = (): UrlCache => {
  if (urlCache) {
    return urlCache
  }
  urlCache = new Map()
  if (typeof window === 'undefined') {
    return urlCache
  }
  try {
    const raw = window.localStorage.getItem(URL_CACHE_KEY)
    const now = Date.now()
    for (const [path, entry] of Object.entries(JSON.parse(raw ?? '{}') as Record<string, [string, number]>)) {
      if (Array.isArray(entry) && entry[1] - now > SIGNED_URL_MIN_REMAINING_MS) {
        urlCache.set(path, entry)
      }
    }
  } catch {
    // localStorage bị chặn / dữ liệu hỏng — dùng cache trong bộ nhớ
  }
  return urlCache
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

const persistUrlCache = () => {
  if (persistTimer || typeof window === 'undefined') {
    return
  }
  persistTimer = setTimeout(() => {
    persistTimer = null
    const cache = getUrlCache()
    // Giữ các entry mới nhất nếu vượt giới hạn
    const entries = [...cache.entries()].slice(-URL_CACHE_MAX_ENTRIES)
    try {
      window.localStorage.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch {
      // Hết quota — bỏ qua
    }
  }, 300)
}

/** URL còn hạn trong cache (đồng bộ) — cho phép render ảnh ngay frame đầu tiên. */
export const getCachedSignedUrl = (path: string | null | undefined): string | undefined => {
  if (!path) {
    return undefined
  }
  const entry = getUrlCache().get(path)
  if (entry && entry[1] - Date.now() > SIGNED_URL_MIN_REMAINING_MS) {
    return entry[0]
  }
  return undefined
}

export const forgetSignedUrls = (paths: string[]) => {
  const cache = getUrlCache()
  paths.forEach((path) => cache.delete(path))
  persistUrlCache()
}

type PendingRequest = {
  resolve: (url: string) => void
  reject: (error: Error) => void
}

let pending = new Map<string, PendingRequest[]>()
const inFlight = new Map<string, Promise<string>>()
let flushScheduled = false

const flushSignedUrlRequests = async () => {
  const batch = pending
  pending = new Map()
  flushScheduled = false

  const paths = [...batch.keys()]
  const requestedAt = Date.now()
  const { data, error } = await getSupabaseBrowserClient()
    .storage.from(PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]))
  const cache = getUrlCache()
  const expiresAt = requestedAt + SIGNED_URL_TTL_SECONDS * 1000

  for (const path of paths) {
    const signedUrl = urls.get(path)
    if (signedUrl) {
      cache.delete(path)
      cache.set(path, [signedUrl, expiresAt])
    }
    for (const waiter of batch.get(path) ?? []) {
      if (signedUrl) {
        waiter.resolve(signedUrl)
      } else {
        waiter.reject(new Error(error?.message ?? `Không lấy được ảnh ${path}`))
      }
    }
  }
  persistUrlCache()
}

export const getSignedPhotoUrl = (path: string): Promise<string> => {
  const cached = getCachedSignedUrl(path)
  if (cached) {
    return Promise.resolve(cached)
  }
  const existing = inFlight.get(path)
  if (existing) {
    return existing
  }

  const request = new Promise<string>((resolve, reject) => {
    const waiters = pending.get(path) ?? []
    waiters.push({ resolve, reject })
    pending.set(path, waiters)

    if (!flushScheduled) {
      flushScheduled = true
      setTimeout(flushSignedUrlRequests, 0)
    }
  }).finally(() => inFlight.delete(path))
  inFlight.set(path, request)
  return request
}

/** Lấy trước URL cho nhiều ảnh trong 1 request (gọi ngay khi có danh sách cây). */
export const primeSignedUrls = (paths: (string | null | undefined)[]) => {
  for (const path of paths) {
    if (path) {
      getSignedPhotoUrl(path).catch(() => {})
    }
  }
}

/** Tải sẵn file ảnh vào HTTP cache (khi trình duyệt rảnh). */
export const warmImages = (urls: string[]) => {
  if (typeof window === 'undefined' || urls.length === 0) {
    return
  }
  const run = () => {
    for (const url of urls) {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    }
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2000 })
  } else {
    setTimeout(run, 300)
  }
}
