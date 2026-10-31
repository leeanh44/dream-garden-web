import { Suspense } from 'react'
import { VideoStudio } from '@/components/video/video-studio'

export default function PlantVideoPage({ params }: PageProps<'/plants/[id]/video'>) {
  return (
    <Suspense fallback={<div className="skeleton h-[70dvh] rounded-[2rem]" />}>
      <VideoStudioWithParams params={params} />
    </Suspense>
  )
}

async function VideoStudioWithParams({ params }: Pick<PageProps<'/plants/[id]/video'>, 'params'>) {
  const { id } = await params
  return <VideoStudio plantId={id} />
}
