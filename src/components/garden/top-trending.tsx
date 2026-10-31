import Link from 'next/link'
import { SparkleIcon, StarIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { TOP_TRENDING_MIN_SCORE, getLatestTimelineEntry, type Plant } from '@/lib/garden'

/** Nổi bật — mẫu cây 10 điểm có ảnh lá mới nhất (giống carousel trong app). */
export function TopTrending({ plants }: { plants: Plant[] }) {
  const slides = plants.filter(
    (plant) => !plant.is_sold && plant.rank_score >= TOP_TRENDING_MIN_SCORE && plant.timeline_entries.length > 0,
  )

  if (slides.length === 0) {
    return null
  }

  return (
    <section className="mb-10">
      <p className="eyebrow flex items-center gap-1.5">
        <SparkleIcon className="text-primary-container" /> Tuyển chọn
      </p>
      <h2 className="mb-4 font-serif text-3xl font-semibold text-on-surface">Nổi bật · 10 điểm</h2>
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-4">
        {slides.map((plant, index) => {
          const latest = getLatestTimelineEntry(plant)
          return (
            <Link
              key={plant.id}
              href={`/plants/${plant.id}`}
              className="group relative w-[72%] shrink-0 snap-center overflow-hidden rounded-[1.75rem] shadow-leaf-lg ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1 sm:w-64"
            >
              <PlantPhoto
                path={latest?.photo_path}
                placeholderPath={latest?.thumb_path}
                alt={`Ảnh lá ${plant.name}`}
                priority={index < 3}
                className="aspect-[4/5] w-full transition-transform duration-700 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span className="pill absolute top-3 left-3 bg-primary-fixed text-primary shadow">
                <StarIcon className="h-3 w-3" /> 10
              </span>
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="truncate font-serif text-xl font-semibold">{plant.name}</p>
                {plant.scientific_name ? (
                  <p className="truncate font-serif text-sm text-white/75 italic">{plant.scientific_name}</p>
                ) : (
                  <p className="text-sm text-white/75">{plant.timeline_entries.length} lá</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
