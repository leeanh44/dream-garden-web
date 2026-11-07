import { GardenView } from '@/components/garden/garden-view'
import { WithGardenData } from '@/components/garden/with-garden-data'
import { getMomentPhotoPaths } from '@/lib/moments'

export default function GardenPage() {
  return (
    // Ký sẵn ảnh cho Khoảnh khắc hôm nay + Nhìn lại
    <WithGardenData extraPaths={getMomentPhotoPaths}>
      <GardenView />
    </WithGardenData>
  )
}
