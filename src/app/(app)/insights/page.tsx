import { InsightsView } from '@/components/insights/insights-view'
import { WithGardenData } from '@/components/garden/with-garden-data'

export const metadata = { title: "Giao dịch · Dream's Garden" }

export default function InsightsPage() {
  return (
    // Ảnh đại diện mỗi cây (danh sách Đã xuất) được ký sẵn trên server
    <WithGardenData>
      <InsightsView />
    </WithGardenData>
  )
}
