import Link from 'next/link'
import { PlantPhoto } from '@/components/plant-photo'
import {
  RANK_PILL_CLASSES,
  formatVndNumber,
  getDaysSinceDate,
  getLatestTimelineEntry,
  getPlantLastPhotoAt,
  getPlantRankTier,
  type Plant,
} from '@/lib/garden'

export function PlantListItem({ plant, variant = 'garden' }: { plant: Plant; variant?: 'garden' | 'sold' }) {
  const latestPhoto = getLatestTimelineEntry(plant)
  const daysSincePhoto = getDaysSinceDate(getPlantLastPhotoAt(plant))
  const leafCount = plant.timeline_entries.length

  const photoAgeBadge =
    variant === 'garden' && leafCount > 0 && daysSincePhoto > 0 ? `📷 ${daysSincePhoto}n` : null

  return (
    <Link
      href={`/plants/${plant.id}`}
      className={`card flex items-stretch gap-3 p-3 transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
        variant === 'sold' ? 'opacity-80' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <PlantPhoto
          path={latestPhoto?.thumb_path ?? latestPhoto?.photo_path}
          alt={`Ảnh lá mới nhất của ${plant.name}`}
          className={`h-20 w-20 rounded-2xl object-cover ${variant === 'sold' ? 'grayscale-[30%]' : ''}`}
        />
        {photoAgeBadge ? (
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-inverse-surface px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-inverse-on-surface"
            aria-hidden="true"
          >
            {photoAgeBadge}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-serif text-lg text-on-surface">{plant.name}</span>
          {variant === 'garden' ? (
            <span
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                RANK_PILL_CLASSES[getPlantRankTier(plant.rank_score)]
              }`}
            >
              ★ {plant.rank_score}
            </span>
          ) : (
            <span className="flex-shrink-0 rounded-full bg-tertiary-container px-2.5 py-1 text-[11px] font-bold text-on-tertiary-container">
              {plant.is_manual_sold_record ? 'Bản ghi' : 'Đã xuất'}
            </span>
          )}
        </div>
        {plant.scientific_name ? (
          <p className="truncate text-xs text-outline italic">{plant.scientific_name}</p>
        ) : null}
        <p className="truncate text-sm text-on-surface-variant">
          {leafCount > 0 ? `${leafCount} lá` : 'Chưa có lá'}
        </p>
        {variant === 'garden' && plant.market_value != null ? (
          <p className="text-sm font-semibold text-primary">₫ {formatVndNumber(plant.market_value)}</p>
        ) : null}
      </div>
    </Link>
  )
}
