import Link from 'next/link'
import { CameraIcon, StarIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import {
  RANK_PILL_CLASSES,
  formatCompactVnd,
  getDaysSinceDate,
  getLatestTimelineEntry,
  getPlantLastPhotoAt,
  getPlantRankTier,
  type Plant,
} from '@/lib/garden'
import { PlantTitle } from '@/components/scientific-name'
import { getPlantDisplayName } from '@/lib/plant-names'

/** Số card hiện ngay màn hình đầu (2 hàng × 4 cột) — tải ảnh ưu tiên cao. */
const ABOVE_THE_FOLD = 8

export function PlantListItem({
  plant,
  index = 0,
  variant = 'garden',
}: {
  plant: Plant
  index?: number
  variant?: 'garden' | 'sold'
}) {
  const latestPhoto = getLatestTimelineEntry(plant)
  const daysSincePhoto = getDaysSinceDate(getPlantLastPhotoAt(plant))
  const display = getPlantDisplayName(plant)
  const leafCount = plant.timeline_entries.length
  const isSold = variant === 'sold'
  const showPhotoAge = !isSold && leafCount > 0 && daysSincePhoto > 0

  return (
    <Link
      href={`/plants/${plant.id}`}
      className="group card flex animate-fade-up flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-leaf-lg active:scale-[0.98]"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative">
        <PlantPhoto
          path={latestPhoto?.thumb_path ?? latestPhoto?.photo_path}
          alt={`Ảnh lá mới nhất của ${plant.name}`}
          priority={index < ABOVE_THE_FOLD}
          className={`aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04] ${
            isSold ? 'grayscale-[40%]' : ''
          }`}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          {isSold ? (
            <span className="pill bg-tertiary-container/90 text-on-tertiary-container backdrop-blur">
              {plant.is_manual_sold_record ? 'Bản ghi' : 'Đã xuất'}
            </span>
          ) : (
            <span className={`pill shadow-sm ${RANK_PILL_CLASSES[getPlantRankTier(plant.rank_score)]}`}>
              <StarIcon className="h-3 w-3" />
              {plant.rank_score}
            </span>
          )}
          {showPhotoAge ? (
            <span
              className={`pill backdrop-blur ${
                daysSincePhoto >= 14 ? 'bg-error-container/95 text-on-error-container' : 'bg-black/45 text-white'
              }`}
              title={`Lần ghi nhận gần nhất: ${daysSincePhoto} ngày trước`}
            >
              <CameraIcon className="h-3 w-3" />
              {daysSincePhoto}n
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 sm:p-4">
        <span className="truncate font-serif text-base leading-snug font-semibold text-on-surface sm:text-lg">
          <PlantTitle display={display} />
        </span>
        {display.vernacular ? <span className="truncate text-xs text-outline">{display.vernacular}</span> : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
          <span className="text-on-surface-variant">{leafCount > 0 ? `${leafCount} lá` : 'Chưa ghi nhận'}</span>
          {!isSold && plant.market_value != null ? (
            <span className="font-bold text-primary">{formatCompactVnd(plant.market_value)} ₫</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
