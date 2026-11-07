import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './env'

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * Supabase client dùng trong Client Components (singleton).
 * Thư viện (~60 KB gzip) được tải lười → không nằm trong JS bắt buộc lúc mở trang;
 * trang chủ đã có dữ liệu server gửi kèm nên không cần nó để hiển thị.
 */
export const getSupabaseBrowserClient = () => {
  clientPromise ??= import('@supabase/ssr').then(({ createBrowserClient }) =>
    createBrowserClient(SUPABASE_URL, SUPABASE_KEY),
  )
  return clientPromise
}

/** Tải sẵn thư viện khi trình duyệt rảnh → thao tác đầu tiên (lưu, chụp ảnh…) không phải chờ. */
export const warmSupabaseClient = () => {
  if (typeof window === 'undefined') {
    return
  }
  const warm = () => void getSupabaseBrowserClient()
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 4000 })
  } else {
    setTimeout(warm, 1500)
  }
}
