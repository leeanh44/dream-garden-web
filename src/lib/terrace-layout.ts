/**
 * Bố cục sân thượng thật (dựng lại từ ảnh chụp vườn) — toạ độ tính bằng mét.
 *
 * Trục: X sang phải, Y lên trên, Z hướng về phía người xem.
 * - Tường tôn phía sau: z = -2.05, chạy từ lan can trái (x = -3) tới tường phải (x = 4.05)
 * - Lan can trái: tường lửng cao 0.95 m + lưới B40, tấm ván đặt chậu nhỏ phía trên
 * - Góc chính (x -2.6…0.6) dưới lưới che nắng · góc mái che (x 1.6…4) bên phải
 *
 * Mỗi "chỗ" (slot) là nơi đặt 1 chậu; danh sách xếp theo độ nổi bật giảm dần —
 * cây hạng cao được đặt vào chỗ đầu danh sách.
 */

export type PotKind = 'nursery' | 'white' | 'terracotta' | 'glazed'

export type TerraceSlot = {
  x: number
  /** Độ cao đáy chậu (đặt trên kệ / đôn / thùng xốp) */
  y: number
  z: number
  scale: number
  pot: PotKind
  hanging?: boolean
  zone: string
}

const MAIN = 'Góc chính'
const COVERED = 'Góc mái che'
const STAND = 'Kệ sắt trắng'
const SHELF = 'Kệ treo tường'
const LEDGE = 'Ván lan can'
const HANGING = 'Chậu treo'
const FLOOR = 'Sàn sân thượng'

export const SHELF_Y = 1.48
export const LEDGE_Y = 0.97
export const STAND_TOP_Y = 1.5

const ledge = (z: number, index: number): TerraceSlot => ({
  x: -2.78,
  y: LEDGE_Y,
  z,
  scale: 0.48,
  pot: index % 2 === 0 ? 'white' : 'terracotta',
  zone: LEDGE,
})

export const TERRACE_SLOTS: TerraceSlot[] = [
  // Cụm chân tường + két Monstera Albo — chỗ nổi bật nhất
  { x: -1.0, y: 0, z: -1.6, scale: 0.95, pot: 'nursery', zone: MAIN },
  { x: 2.7, y: 0.32, z: -1.7, scale: 1, pot: 'nursery', zone: COVERED },
  { x: -0.35, y: 0, z: -1.6, scale: 0.9, pot: 'nursery', zone: MAIN },
  { x: -1.55, y: 0.45, z: -1.55, scale: 0.85, pot: 'nursery', zone: MAIN },
  { x: -1.25, y: 0, z: -1.0, scale: 0.8, pot: 'nursery', zone: MAIN },
  { x: -0.62, y: 0.12, z: -1.0, scale: 0.7, pot: 'white', zone: MAIN },
  { x: 3.42, y: 0.55, z: -0.25, scale: 0.75, pot: 'white', zone: COVERED },
  { x: -2.0, y: 0, z: -1.6, scale: 0.8, pot: 'nursery', zone: MAIN },
  { x: -1.9, y: STAND_TOP_Y, z: -0.2, scale: 0.72, pot: 'nursery', zone: STAND },
  { x: 3.0, y: 0.45, z: -0.75, scale: 0.7, pot: 'white', zone: COVERED },
  { x: -1.75, y: 0, z: -0.95, scale: 0.7, pot: 'white', zone: MAIN },
  { x: 0.02, y: 0, z: -1.05, scale: 0.65, pot: 'white', zone: MAIN },
  { x: 2.15, y: 0, z: -1.55, scale: 0.7, pot: 'terracotta', zone: COVERED },
  { x: 3.6, y: 0.5, z: -1.15, scale: 0.62, pot: 'white', zone: COVERED },
  // Kệ treo tường
  { x: -1.9, y: SHELF_Y, z: -1.8, scale: 0.58, pot: 'nursery', zone: SHELF },
  { x: -0.82, y: SHELF_Y, z: -1.8, scale: 0.6, pot: 'terracotta', zone: SHELF },
  { x: -1.5, y: SHELF_Y + 0.06, z: -1.82, scale: 0.52, pot: 'nursery', zone: SHELF },
  { x: -1.15, y: SHELF_Y + 0.06, z: -1.82, scale: 0.52, pot: 'nursery', zone: SHELF },
  { x: -0.48, y: SHELF_Y, z: -1.78, scale: 0.42, pot: 'white', zone: SHELF },
  // Ván trên tường lửng
  ...[-1.1, -0.62, -0.14, 0.34, 0.82, 1.3, 1.78, 2.26].map(ledge),
  // Chậu treo: tường sau, lưới B40, dưới mái che
  { x: 0.95, y: 1.3, z: -1.82, scale: 0.48, pot: 'nursery', hanging: true, zone: HANGING },
  { x: 1.38, y: 1.3, z: -1.82, scale: 0.48, pot: 'nursery', hanging: true, zone: HANGING },
  { x: -2.72, y: 1.7, z: -0.4, scale: 0.44, pot: 'terracotta', hanging: true, zone: HANGING },
  { x: -2.72, y: 1.7, z: 0.9, scale: 0.44, pot: 'white', hanging: true, zone: HANGING },
  { x: 1.82, y: 1.25, z: -1.82, scale: 0.46, pot: 'nursery', hanging: true, zone: HANGING },
  { x: 2.25, y: 1.25, z: -1.82, scale: 0.46, pot: 'white', hanging: true, zone: HANGING },
]

/** Hết chỗ có sẵn → xếp tiếp thành hàng trên sàn trống phía trước. */
export const getTerraceSlot = (index: number): TerraceSlot => {
  if (index < TERRACE_SLOTS.length) {
    return TERRACE_SLOTS[index]
  }
  const overflow = index - TERRACE_SLOTS.length
  const columns = 6
  const row = Math.floor(overflow / columns)
  return {
    x: 0.55 + (overflow % columns) * 0.58,
    y: 0,
    z: 0.5 + row * 0.6,
    scale: 0.62,
    pot: 'nursery',
    zone: FLOOR,
  }
}
