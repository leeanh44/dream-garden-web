import { Suspense } from 'react'
import { GardenHydration } from '@/components/garden/garden-hydration'
import { GardenView } from '@/components/garden/garden-view'
import { getInitialGarden } from '@/lib/garden-server'

export default function GardenPage() {
  return (
    // Fallback: khung skeleton (lần đầu) hoặc dữ liệu đã cache (điều hướng nội bộ) trong lúc server lấy dữ liệu
    <Suspense fallback={<GardenView awaitServerData />}>
      <GardenWithServerData />
    </Suspense>
  )
}

async function GardenWithServerData() {
  const initial = await getInitialGarden()
  if (!initial) {
    return <GardenView />
  }
  return (
    <GardenHydration initial={initial}>
      <GardenView />
    </GardenHydration>
  )
}
