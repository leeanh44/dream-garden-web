import type { SamPoint } from './sam-protocol'

/** Mặt nạ nhị phân (1 = thuộc lá) cùng độ phân giải với ảnh làm việc. */
export type LeafMask = {
  data: Uint8Array
  width: number
  height: number
  /** Khung bao lá (pixel, theo mặt nạ) */
  box: { x: number; y: number; width: number; height: number }
  /** Số pixel thuộc lá */
  area: number
}

/** Ảnh làm việc cho SAM: cạnh dài ≤1024 (SAM resize về 1024 bên trong). */
export const WORK_MAX_SIZE = 1024
/** Ảnh lá xuất ra: cạnh dài ≤1600 */
const CUTOUT_MAX_SIZE = 1600
const CUTOUT_THUMB_SIZE = 480
/** Lỗ nhỏ hơn tỉ lệ này của diện tích lá coi là nhiễu → lấp. Lỗ lớn hơn (lỗ xẻ Monstera…) giữ nguyên. */
const SMALL_HOLE_RATIO = 0.004

// ---------------------------------------------------------------------------
// Làm sạch mặt nạ
// ---------------------------------------------------------------------------

/** Gán nhãn vùng liên thông 4 hướng của các pixel có giá trị `value`. */
const labelRegions = (data: Uint8Array, width: number, height: number, value: 0 | 1) => {
  const labels = new Int32Array(width * height).fill(-1)
  const sizes: number[] = []
  const touchesBorder: boolean[] = []
  const stack = new Int32Array(width * height)

  for (let start = 0; start < data.length; start += 1) {
    if (data[start] !== value || labels[start] !== -1) {
      continue
    }
    const label = sizes.length
    let size = 0
    let border = false
    let top = 0
    stack[top++] = start
    labels[start] = label
    while (top > 0) {
      const index = stack[--top]
      size += 1
      const x = index % width
      const y = (index - x) / width
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        border = true
      }
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ]
      for (const next of neighbors) {
        if (next >= 0 && data[next] === value && labels[next] === -1) {
          labels[next] = label
          stack[top++] = next
        }
      }
    }
    sizes.push(size)
    touchesBorder.push(border)
  }
  return { labels, sizes, touchesBorder }
}

/**
 * - Chỉ giữ các vùng chứa điểm chạm "thuộc lá" (bỏ mảnh rời rạc SAM bắt nhầm).
 * - Lấp lỗ nhỏ (đốm phản sáng, nhiễu) nhưng giữ lỗ lớn có thật.
 */
export const refineMask = (
  raw: Uint8Array,
  width: number,
  height: number,
  points: SamPoint[],
): LeafMask | null => {
  const data = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    data[i] = raw[i] ? 1 : 0
  }

  const foreground = labelRegions(data, width, height, 1)
  if (foreground.sizes.length === 0) {
    return null
  }

  const keep = new Set<number>()
  for (const point of points) {
    if (point.label !== 1) continue
    const x = Math.min(width - 1, Math.max(0, Math.round(point.x * (width - 1))))
    const y = Math.min(height - 1, Math.max(0, Math.round(point.y * (height - 1))))
    const label = foreground.labels[y * width + x]
    if (label >= 0) keep.add(label)
  }
  // Điểm chạm rơi đúng mép (ngoài mặt nạ) → giữ vùng lớn nhất
  if (keep.size === 0) {
    keep.add(foreground.sizes.indexOf(Math.max(...foreground.sizes)))
  }

  let area = 0
  for (let i = 0; i < data.length; i += 1) {
    data[i] = keep.has(foreground.labels[i]) ? 1 : 0
    area += data[i]
  }

  const background = labelRegions(data, width, height, 0)
  const maxHole = area * SMALL_HOLE_RATIO
  for (let i = 0; i < data.length; i += 1) {
    const label = background.labels[i]
    if (label >= 0 && !background.touchesBorder[label] && background.sizes[label] <= maxHole) {
      data[i] = 1
      area += 1
    }
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    return null
  }
  return { data, width, height, area, box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } }
}

// ---------------------------------------------------------------------------
// % var
// ---------------------------------------------------------------------------

/**
 * Ước tính tỉ lệ var: pixel trong lá có màu trắng / kem (sáng, ít bão hoà)
 * hoặc vàng (aurea, mint sáng). Phần xanh lục bình thường không tính.
 */
export const estimateVarRatio = (image: ImageData, mask: LeafMask) => {
  const { data } = image
  let variegated = 0
  for (let i = 0; i < mask.data.length; i += 1) {
    if (!mask.data[i]) continue
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    const delta = max - min
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
    let hue = 0
    if (delta > 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6)
      else if (max === g) hue = 60 * ((b - r) / delta + 2)
      else hue = 60 * ((r - g) / delta + 4)
      if (hue < 0) hue += 360
    }
    const isWhiteOrCream = lightness > 0.68 && saturation < 0.45
    const isYellow = hue >= 38 && hue <= 72 && lightness > 0.5 && saturation > 0.3
    if (isWhiteOrCream || isYellow) {
      variegated += 1
    }
  }
  return mask.area > 0 ? variegated / mask.area : 0
}

// ---------------------------------------------------------------------------
// Xuất ảnh lá nền trong suốt
// ---------------------------------------------------------------------------

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** Mặt nạ → canvas alpha (trắng đục ở vùng lá) để dùng với `destination-in`. */
export const maskToCanvas = (mask: LeafMask, color = '255,255,255', alpha = 255) => {
  const canvas = createCanvas(mask.width, mask.height)
  const context = canvas.getContext('2d')
  if (!context) return canvas
  const image = context.createImageData(mask.width, mask.height)
  const [r, g, b] = color.split(',').map(Number)
  for (let i = 0; i < mask.data.length; i += 1) {
    if (mask.data[i]) {
      image.data[i * 4] = r
      image.data[i * 4 + 1] = g
      image.data[i * 4 + 2] = b
      image.data[i * 4 + 3] = alpha
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<{ blob: Blob; extension: 'webp' | 'png' }>((resolve, reject) => {
    // WebP có alpha nhẹ hơn PNG nhiều; Safari không mã hoá WebP → tự trả PNG
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không xuất được ảnh lá.'))
        } else if (blob.type === 'image/webp') {
          resolve({ blob, extension: 'webp' })
        } else {
          canvas.toBlob(
            (png) => (png ? resolve({ blob: png, extension: 'png' }) : reject(new Error('Không xuất được ảnh lá.'))),
            'image/png',
          )
        }
      },
      'image/webp',
      0.9,
    )
  })

export type CutoutResult = {
  full: Blob
  thumb: Blob
  extension: 'webp' | 'png'
  width: number
  height: number
}

/**
 * Cắt lá từ ảnh gốc độ phân giải đầy đủ: giữ nguyên 100% pixel gốc, chỉ thêm kênh alpha.
 * Mặt nạ được phóng lên bằng nội suy → mép lá mềm, không răng cưa.
 */
export const renderCutout = async (source: ImageBitmap, mask: LeafMask): Promise<CutoutResult> => {
  const scale = source.width / mask.width
  const pad = Math.round(Math.max(mask.box.width, mask.box.height) * 0.03)
  const box = {
    x: Math.max(0, mask.box.x - pad),
    y: Math.max(0, mask.box.y - pad),
    right: Math.min(mask.width, mask.box.x + mask.box.width + pad),
    bottom: Math.min(mask.height, mask.box.y + mask.box.height + pad),
  }
  const srcX = box.x * scale
  const srcY = box.y * scale
  const srcW = (box.right - box.x) * scale
  const srcH = (box.bottom - box.y) * scale
  const outScale = Math.min(1, CUTOUT_MAX_SIZE / Math.max(srcW, srcH))
  const outW = Math.round(srcW * outScale)
  const outH = Math.round(srcH * outScale)

  const output = createCanvas(outW, outH)
  const context = output.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ canvas.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

  // Áp mặt nạ: phóng mặt nạ cùng vùng cắt, làm mềm mép ~1px
  const maskCanvas = maskToCanvas(mask)
  context.globalCompositeOperation = 'destination-in'
  const feather = Math.max(0.6, outW / (box.right - box.x) / 2)
  if ('filter' in context) {
    context.filter = `blur(${feather.toFixed(2)}px)`
  }
  context.drawImage(maskCanvas, box.x, box.y, box.right - box.x, box.bottom - box.y, 0, 0, outW, outH)
  context.filter = 'none'
  context.globalCompositeOperation = 'source-over'

  const thumbScale = Math.min(1, CUTOUT_THUMB_SIZE / Math.max(outW, outH))
  const thumbCanvas = createCanvas(outW * thumbScale, outH * thumbScale)
  const thumbContext = thumbCanvas.getContext('2d')
  thumbContext?.drawImage(output, 0, 0, thumbCanvas.width, thumbCanvas.height)

  const [full, thumb] = await Promise.all([toBlob(output), toBlob(thumbCanvas)])
  return { full: full.blob, thumb: thumb.blob, extension: full.extension, width: outW, height: outH }
}

/** Thu ảnh về kích thước làm việc của SAM. */
export const toWorkImage = (source: ImageBitmap) => {
  const scale = Math.min(1, WORK_MAX_SIZE / Math.max(source.width, source.height))
  const canvas = createCanvas(source.width * scale, source.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Trình duyệt không hỗ trợ canvas.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return { canvas, imageData: context.getImageData(0, 0, canvas.width, canvas.height) }
}
