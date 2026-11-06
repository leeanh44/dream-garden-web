import { Suspense } from 'react'
import { WithGardenData } from '@/components/garden/with-garden-data'
import { PlantDetail } from '@/components/plant/plant-detail'
import type { Plant } from '@/lib/garden'

export default function PlantPage({ params }: PageProps<'/plants/[id]'>) {
  return (
    <Suspense fallback={<div className="skeleton mt-13 h-[22rem] rounded-[2rem] sm:h-[26rem]" />}>
      <PlantDetailWithParams params={params} />
    </Suspense>
  )
}

async function PlantDetailWithParams({ params }: Pick<PageProps<'/plants/[id]'>, 'params'>) {
  const { id } = await params
  // Ký sẵn ảnh của cây này: ảnh lớn đầu trang + thumbnail mọi lá trong nhật ký
  const plantPaths = (plants: Plant[]) => {
    const entries = plants.find((plant) => plant.id === id)?.timeline_entries ?? []
    return [entries[0]?.photo_path, ...entries.map((entry) => entry.thumb_path)]
  }
  return (
    <WithGardenData extraPaths={plantPaths}>
      <PlantDetail plantId={id} />
    </WithGardenData>
  )
}
