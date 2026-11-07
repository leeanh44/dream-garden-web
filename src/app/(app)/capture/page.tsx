import { QuickCapture } from '@/components/capture/quick-capture'
import { WithGardenData } from '@/components/garden/with-garden-data'

export const metadata = { title: "Chụp nhanh · Dream's Garden" }

export default function CapturePage() {
  return (
    <WithGardenData>
      <QuickCapture />
    </WithGardenData>
  )
}
