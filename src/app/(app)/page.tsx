import { GardenView } from '@/components/garden/garden-view'
import { WithGardenData } from '@/components/garden/with-garden-data'

export default function GardenPage() {
  return (
    <WithGardenData>
      <GardenView />
    </WithGardenData>
  )
}
