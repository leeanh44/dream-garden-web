'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PlantPhoto } from '@/components/plant-photo'
import { ProfileTab } from '@/components/plant/profile-tab'
import { TimelineTab } from '@/components/plant/timeline-tab'
import {
  RANK_PILL_CLASSES,
  formatVndAmount,
  getLatestTimelineEntry,
  getPlantRankTier,
  type Plant,
} from '@/lib/garden'
import { usePlant } from '@/lib/queries'

type DetailTab = 'timeline' | 'profile' | 'trade'

const TABS: { id: DetailTab; label: string; icon: string; comingSoon?: boolean }[] = [
  { id: 'timeline', label: 'Nhật ký', icon: '📷' },
  { id: 'profile', label: 'Hồ sơ', icon: '🌿' },
  { id: 'trade', label: 'Xuất', icon: '💰', comingSoon: true },
]

export function PlantDetail({ plantId }: { plantId: string }) {
  const { plant, isPending, error } = usePlant(plantId)
  const [tab, setTab] = useState<DetailTab>('timeline')

  if (isPending) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-surface-container" aria-label="Đang tải" />
  }

  if (error || !plant) {
    return (
      <div className="card p-8 text-center">
        <p className="mb-4 text-on-surface-variant">{error ? error.message : 'Không tìm thấy cây này.'}</p>
        <Link href="/" className="btn-secondary">
          ← Về Kho cây
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link href="/" className="btn-ghost -ml-4 mb-3">
        ← Kho cây
      </Link>

      <PlantHero plant={plant} />

      <div className="sticky top-16 z-20 -mx-4 mb-6 bg-surface/90 px-4 py-3 backdrop-blur" role="tablist">
        <div className="flex gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              disabled={item.comingSoon}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                tab === item.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
              title={item.comingSoon ? 'Sắp có (giai đoạn 3)' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'timeline' ? <TimelineTab plant={plant} /> : null}
      {tab === 'profile' ? <ProfileTab key={plant.id} plant={plant} /> : null}
    </div>
  )
}

function PlantHero({ plant }: { plant: Plant }) {
  const latest = getLatestTimelineEntry(plant)
  const tier = getPlantRankTier(plant.rank_score)

  return (
    <section className="relative mb-4 overflow-hidden rounded-[2rem] bg-primary-container">
      {latest ? (
        <PlantPhoto
          path={latest.photo_path}
          alt={`Ảnh lá mới nhất của ${plant.name}`}
          loading="eager"
          className="h-64 w-full object-cover sm:h-80"
        />
      ) : (
        <div className="h-48 sm:h-56" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="mb-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${RANK_PILL_CLASSES[tier]}`}>
            ★ {plant.rank_score}
          </span>
          {plant.is_sold ? (
            <span className="rounded-full bg-tertiary-container px-3 py-1 text-xs font-bold text-on-tertiary-container">
              Đã xuất
            </span>
          ) : null}
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {plant.timeline_entries.length} lá
          </span>
          {plant.market_value != null ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              {formatVndAmount(plant.market_value)}
            </span>
          ) : null}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl">{plant.name}</h1>
        {plant.scientific_name ? <p className="text-sm text-white/80 italic">{plant.scientific_name}</p> : null}
      </div>
    </section>
  )
}
