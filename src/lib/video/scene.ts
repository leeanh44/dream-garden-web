import { APP_NAME, formatDate } from '@/lib/garden'
import type { DecodedPhoto, PhotoStore } from './image-store'
import type { VideoSettings } from './settings'

// ---------------------------------------------------------------------------
// Dữ liệu đầu vào
// ---------------------------------------------------------------------------

export type SceneSlide = {
  path: string
  takenAt: Date
  note: string | null
  /** Ngày thứ N kể từ ảnh đầu tiên (ảnh đầu = 1) */
  dayNumber: number
}

export type Scene = {
  plantName: string
  scientificName: string | null
  /** Cũ → mới */
  slides: SceneSlide[]
  fonts: { serif: string; sans: string }
  logo: CanvasImageSource | null
}

const DAY_MS = 24 * 60 * 60 * 1000

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export const buildSlides = (
  entries: { photo_path: string; taken_at: string; note: string | null }[],
): SceneSlide[] => {
  const sorted = [...entries].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime())
  const firstDay = sorted.length > 0 ? startOfLocalDay(new Date(sorted[0].taken_at)) : 0
  return sorted.map((entry) => {
    const takenAt = new Date(entry.taken_at)
    return {
      path: entry.photo_path,
      takenAt,
      note: entry.note?.trim() || null,
      dayNumber: Math.round((startOfLocalDay(takenAt) - firstDay) / DAY_MS) + 1,
    }
  })
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const INTRO_SECONDS = 2.2
const OUTRO_SECONDS = 2
/** Giữ ảnh cuối lâu hơn để người xem kịp nhìn kết quả */
const LAST_PHOTO_HOLD_SECONDS = 1

type Segment =
  | { kind: 'intro'; start: number; own: number }
  | { kind: 'outro'; start: number; own: number }
  | { kind: 'photo'; start: number; own: number; index: number }

export type Timeline = {
  segments: Segment[]
  duration: number
  transition: number
}

export const buildTimeline = (slideCount: number, settings: VideoSettings): Timeline => {
  const transition =
    settings.transition === 'fade' ? Math.min(0.6, settings.secondsPerPhoto * 0.4) : 0
  const segments: Segment[] = []
  let cursor = 0

  if (settings.showTitle) {
    segments.push({ kind: 'intro', start: cursor, own: INTRO_SECONDS })
    cursor += INTRO_SECONDS
  }
  for (let index = 0; index < slideCount; index += 1) {
    const own = settings.secondsPerPhoto + (index === slideCount - 1 ? LAST_PHOTO_HOLD_SECONDS : 0)
    segments.push({ kind: 'photo', start: cursor, own, index })
    cursor += own
  }
  if (settings.showTitle) {
    segments.push({ kind: 'outro', start: cursor, own: OUTRO_SECONDS })
    cursor += OUTRO_SECONDS
  }

  return { segments, duration: cursor, transition }
}

const findSegmentIndex = (timeline: Timeline, time: number) => {
  const { segments } = timeline
  let low = 0
  let high = segments.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (segments[mid].start <= time) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low
}

/** Đường dẫn ảnh cần giải mã quanh thời điểm `time` (trước, hiện tại, 2 ảnh sau). */
export const getPathsAround = (scene: Scene, timeline: Timeline, time: number) => {
  const current = findSegmentIndex(timeline, time)
  const paths: string[] = []
  for (let offset = -1; offset <= 2; offset += 1) {
    const segment = timeline.segments[current + offset]
    if (segment?.kind === 'photo') {
      paths.push(scene.slides[segment.index].path)
    }
  }
  // Thẻ mở đầu / kết thúc dùng ảnh đầu / cuối làm nền
  const first = scene.slides[0]?.path
  const last = scene.slides.at(-1)?.path
  const kind = timeline.segments[current]?.kind
  if (kind === 'intro' && first) paths.push(first)
  if (kind === 'outro' && last) paths.push(last)
  return [...new Set(paths)]
}

// ---------------------------------------------------------------------------
// Vẽ
// ---------------------------------------------------------------------------

const COLORS = {
  primary: '#004f33',
  primaryDark: '#002113',
  mint: '#9ef4c6',
  mintSoft: '#bcedda',
  white: '#ffffff',
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeInOut = (value: number) => 0.5 - Math.cos(Math.PI * value) / 2

type DrawContext = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  /** Đơn vị tỉ lệ: 1 = cạnh ngắn 1080px */
  u: number
  scene: Scene
  settings: VideoSettings
  store: PhotoStore
}

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  time: number,
  scene: Scene,
  timeline: Timeline,
  settings: VideoSettings,
  store: PhotoStore,
) => {
  const { width, height } = ctx.canvas
  const draw: DrawContext = { ctx, width, height, u: Math.min(width, height) / 1080, scene, settings, store }

  ctx.save()
  ctx.globalAlpha = 1
  ctx.fillStyle = COLORS.primaryDark
  ctx.fillRect(0, 0, width, height)

  const index = findSegmentIndex(timeline, time)
  const segment = timeline.segments[index]
  const previous = timeline.segments[index - 1]
  const local = time - segment.start
  const fadeIn = timeline.transition > 0 ? clamp01(local / timeline.transition) : 1

  // Crossfade: vẽ đoạn trước (đang chạy tiếp) rồi phủ đoạn hiện tại với alpha tăng dần
  if (previous && fadeIn < 1) {
    drawSegment(draw, previous, time - previous.start, timeline, 1)
  }
  drawSegment(draw, segment, local, timeline, easeInOut(fadeIn))

  if (settings.showTitle && segment.kind === 'photo') {
    drawHeader(draw)
  }
  drawProgressBar(draw, time / timeline.duration)
  ctx.restore()
}

const drawSegment = (draw: DrawContext, segment: Segment, local: number, timeline: Timeline, alpha: number) => {
  const { ctx } = draw
  ctx.save()
  ctx.globalAlpha = alpha
  if (segment.kind === 'photo') {
    const slide = draw.scene.slides[segment.index]
    const progress = clamp01(local / (segment.own + timeline.transition))
    drawPhoto(draw, draw.store.get(slide.path), segment.index, progress)
    drawCaption(draw, slide)
  } else {
    drawTitleCard(draw, segment.kind, clamp01(local / segment.own))
  }
  ctx.restore()
}

const drawPhoto = (draw: DrawContext, photo: DecodedPhoto | null, index: number, progress: number) => {
  const { ctx, width, height, settings } = draw
  if (!photo) {
    return
  }
  const { bitmap } = photo

  // Ken Burns: xen kẽ zoom vào / zoom ra, trôi nhẹ theo đường chéo
  const zoomIn = index % 2 === 0
  const kb = settings.kenBurns ? (zoomIn ? progress : 1 - progress) : 0
  const scale = 1 + 0.07 * kb
  const driftX = settings.kenBurns ? (index % 4 < 2 ? 1 : -1) * (progress - 0.5) * 0.03 * width : 0
  const driftY = settings.kenBurns ? (progress - 0.5) * 0.02 * height : 0

  if (settings.fit === 'contain') {
    // Nền mờ phủ kín khung
    const bgScale = Math.max(width / photo.blurred.width, height / photo.blurred.height) * 1.15
    const bgW = photo.blurred.width * bgScale
    const bgH = photo.blurred.height * bgScale
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photo.blurred, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH)
    ctx.fillStyle = 'rgba(0, 20, 12, 0.35)'
    ctx.fillRect(0, 0, width, height)
  }

  const baseScale =
    settings.fit === 'contain'
      ? Math.min(width / bitmap.width, height / bitmap.height)
      : Math.max(width / bitmap.width, height / bitmap.height)
  const drawW = bitmap.width * baseScale * scale
  const drawH = bitmap.height * baseScale * scale

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (width - drawW) / 2 + driftX, (height - drawH) / 2 + driftY, drawW, drawH)
}

const drawCaption = (draw: DrawContext, slide: SceneSlide) => {
  const { ctx, width, height, u, settings, scene } = draw
  const showNote = settings.showNotes && slide.note
  if (!settings.showDate && !showNote) {
    return
  }

  const pad = 64 * u
  const gradientHeight = height * (showNote ? 0.42 : 0.3)
  const gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height)
  gradient.addColorStop(0, 'rgba(0, 20, 12, 0)')
  gradient.addColorStop(1, 'rgba(0, 20, 12, 0.82)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, height - gradientHeight, width, gradientHeight)

  let baseline = height - pad - 24 * u
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.white

  if (showNote && slide.note) {
    ctx.font = `500 ${34 * u}px ${scene.fonts.sans}`
    const lines = wrapText(ctx, slide.note, width - pad * 2, 3)
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      ctx.fillText(lines[i], pad, baseline)
      baseline -= 46 * u
    }
    baseline -= 18 * u
  }

  if (settings.showDate) {
    ctx.font = `600 ${76 * u}px ${scene.fonts.serif}`
    const dayLabel = `Ngày ${slide.dayNumber}`
    ctx.fillText(dayLabel, pad, baseline)

    const dateLabel = formatDate(slide.takenAt)
    ctx.font = `700 ${28 * u}px ${scene.fonts.sans}`
    const pillPadX = 20 * u
    const pillH = 50 * u
    const pillW = ctx.measureText(dateLabel).width + pillPadX * 2
    const pillY = baseline - 76 * u - pillH - 18 * u
    ctx.fillStyle = COLORS.mintSoft
    roundRect(ctx, pad, pillY, pillW, pillH, pillH / 2)
    ctx.fill()
    ctx.fillStyle = COLORS.primary
    ctx.textBaseline = 'middle'
    ctx.fillText(dateLabel, pad + pillPadX, pillY + pillH / 2 + 1 * u)
    ctx.textBaseline = 'alphabetic'
  }
}

const drawHeader = (draw: DrawContext) => {
  const { ctx, width, u, scene } = draw
  const pad = 56 * u
  const gradient = ctx.createLinearGradient(0, 0, 0, 260 * u)
  gradient.addColorStop(0, 'rgba(0, 20, 12, 0.6)')
  gradient.addColorStop(1, 'rgba(0, 20, 12, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 260 * u)

  const logoSize = 56 * u
  if (scene.logo) {
    ctx.drawImage(scene.logo, pad, pad, logoSize, logoSize)
  }
  ctx.fillStyle = COLORS.white
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${30 * u}px ${scene.fonts.serif}`
  const nameX = pad + (scene.logo ? logoSize + 18 * u : 0)
  const [name] = wrapText(ctx, scene.plantName, width - nameX - pad, 1)
  ctx.fillText(name, nameX, pad + logoSize / 2)
  ctx.textBaseline = 'alphabetic'
}

const drawTitleCard = (draw: DrawContext, kind: 'intro' | 'outro', progress: number) => {
  const { ctx, width, height, u, scene } = draw
  const backgroundPath = kind === 'intro' ? scene.slides[0]?.path : scene.slides.at(-1)?.path
  const photo = backgroundPath ? draw.store.get(backgroundPath) : null

  if (photo) {
    const bgScale = Math.max(width / photo.blurred.width, height / photo.blurred.height) * 1.2
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      photo.blurred,
      (width - photo.blurred.width * bgScale) / 2,
      (height - photo.blurred.height * bgScale) / 2,
      photo.blurred.width * bgScale,
      photo.blurred.height * bgScale,
    )
  }
  ctx.fillStyle = photo ? 'rgba(0, 47, 30, 0.78)' : COLORS.primary
  ctx.fillRect(0, 0, width, height)

  // Chữ trôi lên nhẹ khi xuất hiện
  const rise = (1 - easeInOut(clamp01(progress * 2.5))) * 30 * u
  const centerX = width / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.white

  if (kind === 'intro') {
    const first = scene.slides[0]
    const last = scene.slides.at(-1)
    let y = height / 2 - 70 * u + rise

    ctx.font = `700 ${24 * u}px ${scene.fonts.sans}`
    ctx.fillStyle = COLORS.mint
    ctx.fillText('N H Ậ T   K Ý   L Á', centerX, y - 90 * u)

    ctx.fillStyle = COLORS.white
    ctx.font = `600 ${84 * u}px ${scene.fonts.serif}`
    const nameLines = wrapText(ctx, scene.plantName, width - 120 * u, 2)
    for (const line of nameLines) {
      ctx.fillText(line, centerX, y)
      y += 96 * u
    }

    if (scene.scientificName) {
      ctx.font = `italic 400 ${34 * u}px ${scene.fonts.serif}`
      ctx.globalAlpha *= 0.85
      const [scientific] = wrapText(ctx, scene.scientificName, width - 120 * u, 1)
      ctx.fillText(scientific, centerX, y - 30 * u)
      ctx.globalAlpha /= 0.85
      y += 30 * u
    }

    if (first && last) {
      ctx.font = `600 ${30 * u}px ${scene.fonts.sans}`
      const range =
        first === last
          ? formatDate(first.takenAt)
          : `${formatDate(first.takenAt)} → ${formatDate(last.takenAt)}`
      ctx.fillText(`${scene.slides.length} lần ghi nhận · ${range}`, centerX, y + 20 * u)
    }
  } else {
    const last = scene.slides.at(-1)
    const logoSize = 140 * u
    const top = height / 2 - 150 * u + rise
    if (scene.logo) {
      ctx.drawImage(scene.logo, centerX - logoSize / 2, top, logoSize, logoSize)
    }
    ctx.font = `600 ${64 * u}px ${scene.fonts.serif}`
    ctx.fillText(APP_NAME, centerX, top + logoSize + 90 * u)
    if (last) {
      ctx.font = `500 ${30 * u}px ${scene.fonts.sans}`
      ctx.fillStyle = COLORS.mint
      ctx.fillText(`${scene.plantName} · ${last.dayNumber} ngày sinh trưởng`, centerX, top + logoSize + 150 * u, width - 120 * u)
    }
  }
  ctx.textAlign = 'left'
}

const drawProgressBar = (draw: DrawContext, progress: number) => {
  const { ctx, width, height, u } = draw
  const barHeight = 6 * u
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.fillRect(0, height - barHeight, width, barHeight)
  ctx.fillStyle = COLORS.mint
  ctx.fillRect(0, height - barHeight, width * clamp01(progress), barHeight)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Ngắt dòng theo từ; dòng cuối thêm "…" nếu bị cắt. */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) {
    lines.push(current)
  }

  if (lines.length <= maxLines) {
    return lines.map((line) => truncate(ctx, line, maxWidth))
  }
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = truncate(ctx, `${kept[maxLines - 1]}…`, maxWidth)
  return kept
}

const truncate = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) {
    return text
  }
  let trimmed = text.replace(/…$/, '')
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed.trimEnd()}…`
}
