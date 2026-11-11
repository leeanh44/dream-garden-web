import { Garden3DView } from '@/components/garden3d/garden-3d-view'
import { WithGardenData } from '@/components/garden/with-garden-data'

export const metadata = { title: "Vườn 3D · Dream's Garden" }

export default function PlannerPage() {
  return (
    // Ảnh đại diện mỗi cây (thẻ polaroid cắm chậu) được ký sẵn trên server
    <WithGardenData>
      <Garden3DView />
    </WithGardenData>
  )
}
