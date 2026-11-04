import type { SupabaseClient } from '@supabase/supabase-js'
import { sortTimelineEntries, type Plant } from '@/lib/garden'

/** Dùng chung cho client (TanStack Query) và server (prefetch trang chủ). */
export const PLANTS_QUERY_KEY = ['plants'] as const

/** Toàn bộ kho cây kèm nhật ký lá, nhật ký sắp xếp mới nhất trước. */
export const selectPlants = async (client: SupabaseClient): Promise<Plant[]> => {
  const { data, error } = await client
    .from('plants')
    .select('*, timeline_entries(*)')
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  return ((data ?? []) as Plant[]).map((plant) => ({
    ...plant,
    timeline_entries: sortTimelineEntries(plant.timeline_entries ?? []),
  }))
}

/** Ảnh đại diện (thumbnail của lá mới nhất) — dùng ở lưới Kho cây, carousel, Chụp nhanh. */
export const getPlantCoverPath = (plant: Plant) => {
  const latest = plant.timeline_entries[0]
  return latest?.thumb_path ?? latest?.photo_path ?? null
}
