import { getSignedPhotoUrl } from '@/lib/photos'

/** Ảnh đã giải mã + bản nền mờ (dùng cho chế độ "vừa khung"). */
export type DecodedPhoto = {
  bitmap: ImageBitmap
  blurred: HTMLCanvasElement
}

const BLUR_WIDTH = 256
const BLUR_RADIUS = 10

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.max(1, height)
  return canvas
}

/** `ctx.filter` có trên Chrome/Firefox; Safari cũ có thuộc tính nhưng bỏ qua → kiểm tra bằng cách vẽ thử. */
let filterSupported: boolean | null = null
const supportsCanvasFilter = () => {
  if (filterSupported == null) {
    const probe = createCanvas(3, 1).getContext('2d', { willReadFrequently: true })
    if (!probe || !('filter' in probe)) {
      filterSupported = false
    } else {
      probe.fillStyle = '#fff'
      probe.fillRect(0, 0, 3, 1)
      probe.filter = 'blur(1px)'
      probe.fillStyle = '#000'
      probe.fillRect(1, 0, 1, 1)
      // Có blur thì pixel bên cạnh bị nhuộm xám
      filterSupported = probe.getImageData(0, 0, 1, 1).data[0] < 250
    }
  }
  return filterSupported
}

const createBlurredBackground = (bitmap: ImageBitmap) => {
  const height = Math.round((bitmap.height / bitmap.width) * BLUR_WIDTH)
  const canvas = createCanvas(BLUR_WIDTH, height)
  const context = canvas.getContext('2d')
  if (!context) {
    return canvas
  }

  if (supportsCanvasFilter()) {
    // Vẽ tràn viền một chút để mép không bị blur ra trong suốt
    const bleed = BLUR_RADIUS * 2
    context.filter = `blur(${BLUR_RADIUS}px)`
    context.drawImage(bitmap, -bleed, -bleed, canvas.width + bleed * 2, canvas.height + bleed * 2)
    return canvas
  }

  // Fallback: thu nhỏ nhiều bậc rồi phóng lên (gần giống box blur)
  const tiny = createCanvas(24, Math.round((bitmap.height / bitmap.width) * 24))
  tiny.getContext('2d')?.drawImage(bitmap, 0, 0, tiny.width, tiny.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(tiny, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Giữ ảnh JPEG đã nén trong bộ nhớ, chỉ giải mã vài ảnh quanh vị trí đang phát
 * — 100 ảnh 2048px giải mã sẵn sẽ tốn >1GB RAM, điện thoại không chịu nổi.
 */
export class PhotoStore {
  private blobs = new Map<string, Promise<Blob>>()
  private decoded = new Map<string, DecodedPhoto>()
  private decoding = new Map<string, Promise<DecodedPhoto>>()

  constructor(private readonly maxDecoded = 4) {}

  /** Tải trước file nén của tất cả ảnh (song song có giới hạn). */
  async preload(paths: string[], onProgress?: (done: number, total: number) => void) {
    let done = 0
    const queue = [...paths]
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        await this.loadBlob(path)
        done += 1
        onProgress?.(done, paths.length)
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, paths.length) }, worker))
  }

  private loadBlob(path: string) {
    let blob = this.blobs.get(path)
    if (!blob) {
      blob = getSignedPhotoUrl(path)
        .then((url) => fetch(url))
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Không tải được ảnh (${response.status})`)
          }
          return response.blob()
        })
      blob.catch(() => this.blobs.delete(path))
      this.blobs.set(path, blob)
    }
    return blob
  }

  get(path: string) {
    return this.decoded.get(path) ?? null
  }

  /** Giải mã các ảnh cần dùng, giải phóng ảnh ngoài cửa sổ. */
  async ensure(paths: string[]) {
    const wanted = new Set(paths)
    for (const [path, photo] of this.decoded) {
      if (!wanted.has(path) && this.decoded.size > this.maxDecoded) {
        photo.bitmap.close()
        this.decoded.delete(path)
      }
    }
    await Promise.all(paths.map((path) => this.decode(path)))
  }

  private decode(path: string) {
    const existing = this.decoded.get(path)
    if (existing) {
      return Promise.resolve(existing)
    }
    let pending = this.decoding.get(path)
    if (!pending) {
      pending = this.loadBlob(path)
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          const photo = { bitmap, blurred: createBlurredBackground(bitmap) }
          this.decoded.set(path, photo)
          return photo
        })
        .finally(() => this.decoding.delete(path))
      this.decoding.set(path, pending)
    }
    return pending
  }

  dispose() {
    for (const photo of this.decoded.values()) {
      photo.bitmap.close()
    }
    this.decoded.clear()
    this.blobs.clear()
  }
}
