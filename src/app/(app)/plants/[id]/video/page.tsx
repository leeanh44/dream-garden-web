import { Suspense } from 'react'
import { WithGardenData } from '@/components/garden/with-garden-data'
import { VideoStudio } from '@/components/video/video-studio'
import type { Plant } from '@/lib/garden'

export default function PlantVideoPage({ params }: PageProps<'/plants/[id]/video'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[70dvh] rounded-[2rem]" />}>
      <VideoStudioWithParams params={params} />
    </Suspense>
  )
}

async function VideoStudioWithParams({ params }: Pick<PageProps<'/plants/[id]/video'>, 'params'>) {
  const { id } = await params
  const plantThumbs = (plants: Plant[]) =>
    (plants.find((plant) => plant.id === id)?.timeline_entries ?? []).map((entry) => entry.thumb_path ?? entry.photo_path)
  return (
    <WithGardenData extraPaths={plantThumbs}>
      <VideoStudio plantId={id} />
    </WithGardenData>
  )
}
