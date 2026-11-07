import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query'
import type { Plant } from '@/lib/garden'
import { PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/photos'
import { PLANTS_QUERY_KEY, getPlantCoverPath, selectPlants } from '@/lib/plants-data'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type InitialGarden = {
  dehydratedState: DehydratedState
  /** path → signed URL cho ảnh đại diện mỗi cây */
  signedUrls: Record<string, string>
  signedAt: number
}

/**
 * Lấy kho cây + ký URL ảnh đại diện ngay trên server (cùng region với Supabase) rồi gửi kèm HTML.
 * Client không còn phải chờ JS chạy xong mới gọi Supabase 2 lượt nối tiếp.
 * Lỗi → `null`, trang tự lấy dữ liệu phía client như trước.
 */
export const getInitialGarden = async (
  extraPaths?: (plants: Plant[]) => (string | null | undefined)[],
): Promise<InitialGarden | null> => {
  if (!isSupabaseConfigured) {
    return null
  }
  try {
    const supabase = await createSupabaseServerClient()
    const plants = await selectPlants(supabase)

    const paths = [
      ...new Set(
        [...plants.map(getPlantCoverPath), ...(extraPaths?.(plants) ?? [])].filter((path): path is string => Boolean(path)),
      ),
    ]
    const signedAt = Date.now()
    const signedUrls: Record<string, string> = {}
    if (paths.length > 0) {
      const { data } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) {
          signedUrls[item.path] = item.signedUrl
        }
      }
    }

    const queryClient = new QueryClient()
    queryClient.setQueryData(PLANTS_QUERY_KEY, plants)
    return { dehydratedState: dehydrate(queryClient), signedUrls, signedAt }
  } catch {
    return null
  }
}
