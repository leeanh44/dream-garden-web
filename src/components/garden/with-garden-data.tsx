import { Suspense, type ReactNode } from 'react'
import { GardenHydration } from '@/components/garden/garden-hydration'
import type { Plant } from '@/lib/garden'
import { getInitialGarden } from '@/lib/garden-server'
import { ServerDataPending } from '@/lib/server-data-pending'

type ExtraPaths = (plants: Plant[]) => (string | null | undefined)[]

/**
 * Server lấy kho cây + ký sẵn URL ảnh rồi gửi kèm HTML → trang hiện ngay khi hydrate,
 * không phải chờ JS tải xong mới gọi Supabase.
 * Trong lúc chờ: hiện `children` ở chế độ chờ (khung skeleton, hoặc dữ liệu đã cache khi điều hướng nội bộ).
 * `extraPaths`: ảnh cần ký thêm ngoài ảnh đại diện mỗi cây (VD: ảnh của trang chi tiết).
 */
export function WithGardenData({ children, extraPaths }: { children: ReactNode; extraPaths?: ExtraPaths }) {
  return (
    <Suspense fallback={<ServerDataPending>{children}</ServerDataPending>}>
      <GardenData extraPaths={extraPaths}>{children}</GardenData>
    </Suspense>
  )
}

async function GardenData({ children, extraPaths }: { children: ReactNode; extraPaths?: ExtraPaths }) {
  const initial = await getInitialGarden(extraPaths)
  if (!initial) {
    return children
  }
  return <GardenHydration initial={initial}>{children}</GardenHydration>
}
