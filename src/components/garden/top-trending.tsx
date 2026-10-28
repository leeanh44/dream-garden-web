import Link from 'next/link'
import { PlantPhoto } from '@/components/plant-photo'
import { TOP_TRENDING_MIN_SCORE, getLatestTimelineEntry, type Plant } from '@/lib/garden'

/** Nổi bật — cây 10 điểm có ảnh lá mới nhất (giống carousel trong app). */
export function TopTrending({ plants }: { plants: Plant[] }) {
  const slides = plants.filter(
    (plant) => !plant.is_sold && plant.rank_score >= TOP_TRENDING_MIN_SCORE && plant.timeline_entries.length > 0,
  )

  if (slides.length === 0) {
    return null
  }

  return (
    <section className="mb-8">
      <p className="text-[11px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Curation</p>
      <h2 className="mb-4 font-serif text-3xl text-on-surface">Nổi bật · 10 điểm</h2>
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {slides.map((plant) => {
          const latest = getLatestTimelineEntry(plant)
          return (
            <Link
              key={plant.id}
              href={`/plants/${plant.id}`}
              className="card w-[78%] flex-shrink-0 snap-center p-4 sm:w-72"
            >
              <PlantPhoto
                path={latest?.photo_path}
                alt={`Ảnh lá ${plant.name}`}
                className="aspect-[4/5] w-full rounded-2xl object-cover"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate font-serif text-lg text-primary">{plant.name}</span>
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-on-primary">
                  10.0
                </span>
              </div>
              {plant.scientific_name ? (
                <p className="truncate text-sm text-on-surface-variant">{plant.scientific_name}</p>
              ) : null}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
