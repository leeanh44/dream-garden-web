import {
  DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
  getDaysSinceDate,
  getPlantLastPhotoAt,
  getPlantRankTier,
  type Plant,
  type PlantRankTier,
} from '@/lib/garden'
import { getPlantCoverPath } from '@/lib/plants-data'
import { getTerraceSlot, type TerraceSlot } from '@/lib/terrace-layout'

/**
 * Dữ liệu 1 cây trong Vườn 3D — rút gọn từ `Plant`, kèm chỗ đặt trên sân thượng (`slot`).
 * Hình dáng cây sinh ra từ dữ liệu thật:
 * - chiều cao + cỡ lá ← hạng (rank 1–10)
 * - số lá ← số ảnh trong Nhật ký lá
 * - lá rủ xuống ← lâu chưa chụp (≥ 14 ngày)
 * - đốm cẩm thạch ← tên / dòng có "Albo", "Thai", "Variegata"…
 */
export type Plant3D = {
  id: string
  name: string
  rankScore: number
  tier: PlantRankTier
  leafCount: number
  photoCount: number
  daysSincePhoto: number
  isStale: boolean
  /** 0 = xanh trơn · 1 = cẩm thạch dày */
  variegation: number
  seed: number
  coverPath: string | null
  slot: TerraceSlot
}

const MIN_LEAVES = 3
const MAX_LEAVES = 14

const VARIEGATED = /albo|variegat|\bvar\b|thai|aurea|marble|mint|half.?moon|camo|sakura|pink/i

/** FNV-1a — hạt giống ổn định theo id → mỗi cây luôn có dáng giống nhau giữa các lần mở. */
export const hashString = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32 — số ngẫu nhiên có hạt giống, trả về [0, 1). */
export const seededRandom = (seed: number) => {
  let state = seed || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Cây đang có trong vườn (chưa bán), đặt lên sân thượng:
 * hạng cao vào chỗ nổi bật trước (cụm chân tường, két Albo), rồi kệ, ván lan can, chậu treo.
 */
export const toPlants3D = (plants: Plant[]): Plant3D[] => {
  const active = plants
    .filter((plant) => !plant.is_sold)
    .sort((left, right) => right.rank_score - left.rank_score || left.name.localeCompare(right.name, 'vi'))

  return active.map((plant, index) => {
    const seed = hashString(plant.id)
    const random = seededRandom(seed)
    const label = `${plant.name} ${plant.cultivar ?? ''} ${plant.scientific_name ?? ''}`
    const daysSincePhoto = getDaysSinceDate(getPlantLastPhotoAt(plant))
    const photoCount = plant.timeline_entries.length

    return {
      id: plant.id,
      name: plant.name,
      rankScore: plant.rank_score,
      tier: getPlantRankTier(plant.rank_score),
      leafCount: Math.min(MAX_LEAVES, Math.max(MIN_LEAVES, MIN_LEAVES + photoCount)),
      photoCount,
      daysSincePhoto,
      isStale: daysSincePhoto >= DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
      variegation: VARIEGATED.test(label) ? 0.35 + random() * 0.4 : random() * 0.06,
      seed,
      coverPath: getPlantCoverPath(plant),
      slot: getTerraceSlot(index),
    }
  })
}
