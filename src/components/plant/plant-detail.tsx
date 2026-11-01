'use client'

import Link from 'next/link'
import { useState, type ComponentType } from 'react'
import { ArrowLeftIcon, CameraIcon, FilmIcon, LeafIcon, StarIcon, WalletIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { ProfileTab } from '@/components/plant/profile-tab'
import { TimelineTab } from '@/components/plant/timeline-tab'
import {
  RANK_PILL_CLASSES,
  formatVndAmount,
  getDaysSinceDate,
  getLatestTimelineEntry,
  getPlantRankTier,
  type Plant,
} from '@/lib/garden'
import { usePlant } from '@/lib/queries'
import { PlantTitle } from '@/components/scientific-name'
import { getPlantDisplayName } from '@/lib/plant-names'

type DetailTab = 'timeline' | 'profile' | 'trade'

const TABS: { id: DetailTab; label: string; icon: ComponentType<{ className?: string }>; comingSoon?: boolean }[] = [
  { id: 'timeline', label: 'Nhật ký', icon: CameraIcon },
  { id: 'profile', label: 'Hồ sơ', icon: LeafIcon },
  { id: 'trade', label: 'Xuất', icon: WalletIcon, comingSoon: true },
]

export function PlantDetail({ plantId }: { plantId: string }) {
  const { plant, isPending, error } = usePlant(plantId)
  const [tab, setTab] = useState<DetailTab>('timeline')

  if (isPending) {
    return <PlantDetailSkeleton />
  }

  if (error || !plant) {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <LeafIcon className="mb-3 text-4xl text-outline-variant" />
        <p className="mb-4 text-on-surface-variant">{error ? error.message : 'Không tìm thấy mẫu cây này.'}</p>
        <Link href="/" className="btn-secondary">
          <ArrowLeftIcon /> Về Kho cây
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <Link href="/" className="btn-ghost -ml-3 mb-3">
        <ArrowLeftIcon /> Kho cây
      </Link>

      <PlantHero plant={plant} />

      <div
        className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-20 -mx-4 mb-6 bg-surface/85 px-4 py-3 backdrop-blur-xl"
        role="tablist"
        aria-label="Thông tin cây"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                disabled={item.comingSoon}
                onClick={() => setTab(item.id)}
                className="chip disabled:cursor-not-allowed disabled:opacity-45"
                title={item.comingSoon ? 'Sắp có (giai đoạn 3)' : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.id === 'timeline' && plant.timeline_entries.length > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                      tab === 'timeline' ? 'bg-white/20' : 'bg-surface-container'
                    }`}
                  >
                    {plant.timeline_entries.length}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'timeline' ? <TimelineTab plant={plant} /> : null}
      {tab === 'profile' ? <ProfileTab key={plant.id} plant={plant} /> : null}
    </div>
  )
}

function PlantHero({ plant }: { plant: Plant }) {
  const display = getPlantDisplayName(plant)
  const latest = getLatestTimelineEntry(plant)
  const tier = getPlantRankTier(plant.rank_score)
  const leafCount = plant.timeline_entries.length
  const first = plant.timeline_entries.at(-1)
  const trackedDays = first ? getDaysSinceDate(new Date(first.taken_at)) + 1 : 0

  return (
    <section className="relative mb-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-container to-[#002f1e] shadow-leaf-lg">
      {latest ? (
        <PlantPhoto
          path={latest.photo_path}
          placeholderPath={latest.thumb_path}
          alt={`Ảnh lá mới nhất của ${plant.name}`}
          priority
          className="h-[22rem] w-full sm:h-[26rem]"
        />
      ) : (
        <div className="relative h-56 sm:h-64" aria-hidden="true">
          <LeafIcon className="absolute top-6 right-6 h-40 w-40 rotate-12 text-primary-fixed/15" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />

      {leafCount >= 2 ? (
        <Link
          href={`/plants/${plant.id}/video`}
          className="absolute top-4 right-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/20 px-4 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-md transition-colors hover:bg-white/30"
        >
          <FilmIcon /> Tạo video
        </Link>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`pill text-xs ${RANK_PILL_CLASSES[tier]}`}>
            <StarIcon className="h-3.5 w-3.5" /> {plant.rank_score}
          </span>
          {plant.is_sold ? (
            <span className="pill bg-tertiary-container text-xs text-on-tertiary-container">Đã xuất</span>
          ) : null}
          {plant.cultivar ? (
            <span className="pill bg-white/90 text-xs text-primary">Dòng {plant.cultivar}</span>
          ) : null}
          <span className="pill bg-white/20 text-xs font-semibold backdrop-blur">{leafCount} lá</span>
          {trackedDays > 0 ? (
            <span className="pill bg-white/20 text-xs font-semibold backdrop-blur">{trackedDays} ngày theo dõi sinh trưởng</span>
          ) : null}
          {plant.market_value != null ? (
            <span className="pill bg-primary-fixed text-xs text-primary">{formatVndAmount(plant.market_value)}</span>
          ) : null}
        </div>
        <h1 className="font-serif text-3xl leading-tight font-semibold text-balance sm:text-5xl">
          <PlantTitle display={display} />
        </h1>
        {display.vernacular ? <p className="mt-1 text-base text-white/80">{display.vernacular}</p> : null}
      </div>
    </section>
  )
}

function PlantDetailSkeleton() {
  return (
    <div aria-label="Đang tải" aria-busy="true">
      <div className="skeleton mb-3 h-10 w-28 rounded-full" />
      <div className="skeleton mb-4 h-[22rem] rounded-[2rem] sm:h-[26rem]" />
      <div className="mb-6 flex gap-2">
        <div className="skeleton h-9 w-28 rounded-full" />
        <div className="skeleton h-9 w-24 rounded-full" />
      </div>
      <div className="skeleton h-80 rounded-3xl" />
    </div>
  )
}
