import {
  DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
  getDaysSinceDate,
  getPlantLastPhotoAt,
  getPlantRankTier,
  type Plant,
  type PlantRankTier,
} from '@/lib/garden'
import { getPlantCoverPath } from '@/lib/plants-data'

/**
 * Dữ liệu 1 cây trong Vườn 3D — rút gọn từ `Plant`, đã tính sẵn vị trí trên luống.
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
  x: number
  z: number
}

/** Khoảng cách giữa 2 chậu (đơn vị three.js ≈ mét). */
export const PLANT_SPACING = 1.35
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
 * Cây đang có trong vườn (chưa bán), xếp lên luống theo lưới:
 * hạng cao ở hàng sau (cây cao đứng sau như vườn thật), hàng cuối căn giữa.
 */
export const toPlants3D = (plants: Plant[]): Plant3D[] => {
  const active = plants
    .filter((plant) => !plant.is_sold)
    .sort((left, right) => right.rank_score - left.rank_score || left.name.localeCompare(right.name, 'vi'))
  const columns = Math.max(1, Math.ceil(Math.sqrt(active.length * 1.4)))
  const rows = Math.ceil(active.length / columns)

  return active.map((plant, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const inRow = row === rows - 1 ? active.length - row * columns : columns
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
      x: (column - (inRow - 1) / 2) * PLANT_SPACING,
      z: (row - (rows - 1) / 2) * PLANT_SPACING,
    }
  })
}

/** Kích thước luống (rộng theo X, sâu theo Z) chứa toàn bộ cây. */
export const getGardenSize = (plants: Plant3D[]) => {
  if (plants.length === 0) {
    return { width: PLANT_SPACING, depth: PLANT_SPACING }
  }
  const xs = plants.map((plant) => plant.x)
  const zs = plants.map((plant) => plant.z)
  return {
    width: Math.max(...xs) - Math.min(...xs) + PLANT_SPACING,
    depth: Math.max(...zs) - Math.min(...zs) + PLANT_SPACING,
  }
}
