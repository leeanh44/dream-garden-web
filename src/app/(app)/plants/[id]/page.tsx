import { Suspense } from 'react'
import { PlantDetail } from '@/components/plant/plant-detail'

export default function PlantPage({ params }: PageProps<'/plants/[id]'>) {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-[2rem] bg-surface-container" />}>
      <PlantDetailWithParams params={params} />
    </Suspense>
  )
}

async function PlantDetailWithParams({ params }: Pick<PageProps<'/plants/[id]'>, 'params'>) {
  const { id } = await params
  return <PlantDetail plantId={id} />
}
