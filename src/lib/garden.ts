import { getPlantDisplayName, normalizeName } from '@/lib/plant-names'
// Types + helpers port từ app iOS (garden-app/src/App.tsx) — giữ nguyên quy tắc rank, VNĐ, thuật ngữ.

export const APP_NAME = "Dream's Garden"

const GARDEN_SLOGANS = [
  'Nurturing every node, loving every leaf.',
  'Every plant, every day, in every way.',
  'Theo dõi từng sắc Var, nâng niu từng chiếc lá.',
  'Grow with love, leaf by leaf.',
  'Chăm từng mầm nhỏ, mở lối vườn mơ.',
  'One node at a time.',
  'Where every leaf is a story told, and every var is green turned gold.',
  'Gói trọn tình yêu vào sắc xanh của lá.',
  'Keep calm and check your plants.',
  'Tưới yêu thương vào từng mắt mầm nhỏ.',
] as const

export const pickRandomGardenSlogan = () =>
  GARDEN_SLOGANS[Math.floor(Math.random() * GARDEN_SLOGANS.length)]

// ---------------------------------------------------------------------------
// Types (khớp supabase/migrations/0001_init.sql)
// ---------------------------------------------------------------------------

export type GeminiPlantInfo = {
  scientificName: string
  family: string
  origin: string
  characteristics: string
  light: string
  watering: string
  humidity: string
  temperature: string
  soil: string
  tips: string
}

export type TimelineEntry = {
  id: string
  plant_id: string
  photo_path: string
  thumb_path: string | null
  taken_at: string
  note: string | null
  created_at: string
}

export type Plant = {
  id: string
  name: string
  scientific_name: string | null
  /** Dòng / cultivar (VD: Thai Constellation) — gom bộ sưu tập lá */
  cultivar: string | null
  rank_score: number
  purchased_at: string | null
  purchase_price: number | null
  market_value: number | null
  parent_plant_id: string | null
  is_sold: boolean
  sold_at: string | null
  is_manual_sold_record: boolean
  ai_info: GeminiPlantInfo | null
  created_at: string
  updated_at: string
  /** Đã sắp xếp mới → cũ */
  timeline_entries: TimelineEntry[]
}

/** Lá đã tách nền (bảng `leaf_cutouts`). */
export type LeafCutout = {
  id: string
  plant_id: string
  entry_id: string
  cutout_path: string
  thumb_path: string | null
  width: number
  height: number
  /** 0–1 */
  var_ratio: number | null
  points: { x: number; y: number; label: 0 | 1 }[] | null
  created_at: string
}

/** Khoá gom "dòng": cultivar → tên khoa học → tên cây. */
/**
 * Dòng cây để gom Bộ sưu tập lá: theo danh pháp + dòng (vd. Monstera deliciosa 'Albo'),
 * không có danh pháp thì theo dòng / tên Việt.
 */
export const getPlantLine = (plant: Pick<Plant, 'cultivar' | 'scientific_name' | 'name'>) => {
  const display = getPlantDisplayName(plant)
  const title = display.latin ? display.title : plant.cultivar?.trim() || display.title
  return {
    key: normalizeName(title),
    title,
    display: display.latin ? display : { ...display, title, latin: null, cultivar: null },
  }
}

export const formatVarRatio = (ratio: number | null) => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`)

export type PlantSortMode = 'name' | 'createdAt'
export type PlantRankFilter = 'all' | 'top1' | 'top2' | 'top3'
export type PlantRankTier = Exclude<PlantRankFilter, 'all'>

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

export const DEFAULT_PLANT_RANK_SCORE = 5
export const PLANT_RANK_MIN = 1
export const PLANT_RANK_MAX = 10
export const TOP_TRENDING_MIN_SCORE = 10
export const DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS = 14

export const clampPlantRankScore = (value: number) =>
  Math.min(PLANT_RANK_MAX, Math.max(PLANT_RANK_MIN, Math.round(value)))

export const getPlantRankTier = (score: number): PlantRankTier => {
  if (score >= 9) {
    return 'top1'
  }
  if (score >= 7) {
    return 'top2'
  }
  return 'top3'
}

export const matchesPlantRankFilter = (score: number, filter: PlantRankFilter) =>
  filter === 'all' || getPlantRankTier(score) === filter

export const RANK_FILTER_LABELS: Record<PlantRankFilter, string> = {
  all: 'Tất cả',
  top1: 'Top 1 · 9–10',
  top2: 'Top 2 · 7–8',
  top3: 'Top 3 · <7',
}

export const RANK_PILL_CLASSES: Record<PlantRankTier, string> = {
  top1: 'bg-primary text-on-primary',
  top2: 'bg-secondary-container text-on-secondary-container',
  top3: 'bg-surface-container-high text-on-surface-variant',
}

// ---------------------------------------------------------------------------
// Timeline / ngày
// ---------------------------------------------------------------------------

export const sortTimelineEntries = (entries: TimelineEntry[]) =>
  [...entries].sort(
    (left, right) => new Date(right.taken_at).getTime() - new Date(left.taken_at).getTime(),
  )

export const getLatestTimelineEntry = (plant: Plant) => plant.timeline_entries[0] ?? null

export const getPlantLastPhotoAt = (plant: Plant) => {
  const latest = getLatestTimelineEntry(plant)
  return new Date(latest ? latest.taken_at : plant.created_at)
}

export const getDaysSinceDate = (date: Date) =>
  Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const formatDate = (value: string | Date) => dateFormatter.format(new Date(value))

/** `yyyy-mm-dd` theo giờ địa phương — dùng cho <input type="date">. */
export const toDateInputValue = (value: string | Date) => {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ---------------------------------------------------------------------------
// VNĐ
// ---------------------------------------------------------------------------

export const VND_UNIT = '₫'
export const VND_INPUT_PLACEHOLDER = '250.000 ₫'

export const formatVndNumber = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)

/** 1.250.000 → "1,3tr" · 2.500.000.000 → "2,5 tỷ" (thẻ thống kê). */
export const formatCompactVnd = (amount: number) => {
  const format = (value: number, unit: string) =>
    `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}${unit}`
  if (amount >= 1_000_000_000) {
    return format(amount / 1_000_000_000, ' tỷ')
  }
  if (amount >= 1_000_000) {
    return format(amount / 1_000_000, 'tr')
  }
  if (amount >= 1_000) {
    return format(amount / 1_000, 'k')
  }
  return formatVndNumber(amount)
}

export const formatVndAmount = (amount: number) => `${formatVndNumber(amount)} ${VND_UNIT}`

export const parseVndAmount = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—' || trimmed === '-') {
    return null
  }

  const withoutCurrency = trimmed
    .replace(/\b(vnd|dong)\b/gi, ' ')
    .replace(/[₫đ]/gi, ' ')
    .trim()
  const digits = withoutCurrency.replace(/\D/g, '')

  if (!digits) {
    return null
  }

  const parsed = Number(digits)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const formatPriceInput = (value: string) => {
  const amount = parseVndAmount(value)
  return amount == null ? '' : formatVndNumber(amount)
}
