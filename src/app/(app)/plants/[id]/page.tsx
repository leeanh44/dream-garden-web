import { Suspense } from 'react'
import { PlantDetail } from '@/components/plant/plant-detail'

export default function PlantPage({ params }: PageProps<'/plants/[id]'>) {
  return (
    <Suspense fallback={<div className="skeleton mt-13 h-[22rem] rounded-[2rem] sm:h-[26rem]" />}>
      <PlantDetailWithParams params={params} />
    </Suspense>
  )
}

async function PlantDetailWithParams({ params }: Pick<PageProps<'/plants/[id]'>, 'params'>) {
  const { id } = await params
  return <PlantDetail plantId={id} />
}
