import { CollectionView } from '@/components/collection/collection-view'
import { WithGardenData } from '@/components/garden/with-garden-data'
import type { Plant } from '@/lib/garden'

export const metadata = { title: "Bộ sưu tập · Dream's Garden" }

/** Ảnh trong Bộ sưu tập (thumbnail + bản full) — ký sẵn trên server. */
const featuredPaths = (plants: Plant[]) =>
  plants.flatMap((plant) =>
    plant.timeline_entries
      .filter((entry) => entry.featured_at)
      .flatMap((entry) => [entry.thumb_path, entry.photo_path]),
  )

export default function CollectionPage() {
  return (
    <WithGardenData extraPaths={featuredPaths}>
      <CollectionView />
    </WithGardenData>
  )
}
