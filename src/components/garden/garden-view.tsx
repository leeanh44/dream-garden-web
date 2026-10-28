'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { AddPlantDialog } from '@/components/garden/add-plant-dialog'
import { PlantListItem } from '@/components/garden/plant-list-item'
import { TopTrending } from '@/components/garden/top-trending'
import {
  DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
  RANK_FILTER_LABELS,
  getDaysSinceDate,
  getPlantLastPhotoAt,
  matchesPlantRankFilter,
  type Plant,
  type PlantRankFilter,
  type PlantSortMode,
} from '@/lib/garden'
import { usePlants } from '@/lib/queries'
import { useLocalStorageState } from '@/lib/use-local-storage'

const RANK_FILTERS = ['all', 'top1', 'top2', 'top3'] as const
const SORT_MODES = ['createdAt', 'name'] as const

const sortPlants = (plants: Plant[], mode: PlantSortMode) =>
  [...plants].sort((left, right) =>
    mode === 'name'
      ? left.name.localeCompare(right.name, 'vi')
      : new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )

export function GardenView() {
  const { data: plants, isPending, error, refetch } = usePlants()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [rankFilter, setRankFilter] = useLocalStorageState<PlantRankFilter>(
    'dg.rankFilter',
    'all',
    RANK_FILTERS,
  )
  const [sortMode, setSortMode] = useLocalStorageState<PlantSortMode>('dg.plantSort', 'createdAt', SORT_MODES)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const { activePlants, soldPlants, staleCount, stalePlant } = useMemo(() => {
    const all = plants ?? []
    const active = all.filter((plant) => !plant.is_sold)
    const stale = active.filter(
      (plant) => getDaysSinceDate(getPlantLastPhotoAt(plant)) >= DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
    )
    return {
      activePlants: active,
      soldPlants: all.filter((plant) => plant.is_sold),
      staleCount: stale.length,
      // Cây lâu chưa chụp nhất
      stalePlant: stale.sort(
        (left, right) => getPlantLastPhotoAt(left).getTime() - getPlantLastPhotoAt(right).getTime(),
      )[0],
    }
  }, [plants])

  const visiblePlants = useMemo(() => {
    const keyword = deferredSearch.trim().toLocaleLowerCase('vi')
    const filtered = activePlants.filter(
      (plant) =>
        matchesPlantRankFilter(plant.rank_score, rankFilter) &&
        (!keyword ||
          plant.name.toLocaleLowerCase('vi').includes(keyword) ||
          plant.scientific_name?.toLocaleLowerCase('vi').includes(keyword)),
    )
    return sortPlants(filtered, sortMode)
  }, [activePlants, deferredSearch, rankFilter, sortMode])

  if (isPending) {
    return <GardenSkeleton />
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="mb-4 text-on-surface-variant">Không tải được kho cây: {error.message}</p>
        <button type="button" onClick={() => refetch()} className="btn-secondary">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <>
      <TopTrending plants={activePlants} />

      {stalePlant ? (
        <Link
          href={`/plants/${stalePlant.id}`}
          className="mb-6 flex items-center gap-3 rounded-3xl border-l-4 border-primary bg-surface-container-low p-4"
        >
          <span className="text-2xl" aria-hidden="true">
            📸
          </span>
          <span className="text-sm text-on-surface-variant">
            <strong className="text-on-surface">{staleCount} cây</strong> đã hơn{' '}
            {DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS} ngày chưa chụp lá. Cập nhật{' '}
            <strong className="text-primary">{stalePlant.name}</strong> nhé!
          </span>
        </Link>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-on-surface">Kho cây</h1>
            <p className="text-sm text-on-surface-variant">{activePlants.length} cây đang nuôi</p>
          </div>
          <button type="button" onClick={() => setIsAddOpen(true)} className="btn-primary hidden md:inline-flex">
            + Thêm cây
          </button>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field-input sm:max-w-xs"
            placeholder="Tìm theo tên cây…"
            aria-label="Tìm kiếm cây"
          />
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {RANK_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setRankFilter(filter)}
                aria-pressed={rankFilter === filter}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  rankFilter === filter
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {RANK_FILTER_LABELS[filter]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'name' ? 'createdAt' : 'name')}
            className="btn-ghost self-start sm:ml-auto sm:self-auto"
            title="Đổi cách sắp xếp"
          >
            {sortMode === 'name' ? '🔤 Tên A–Z' : '🕒 Mới thêm'}
          </button>
        </div>

        {activePlants.length === 0 ? (
          <EmptyGarden onAdd={() => setIsAddOpen(true)} />
        ) : visiblePlants.length === 0 ? (
          <p className="py-10 text-center text-on-surface-variant">Không có cây nào khớp bộ lọc.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePlants.map((plant) => (
              <PlantListItem key={plant.id} plant={plant} />
            ))}
          </div>
        )}
      </section>

      {soldPlants.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 font-serif text-2xl text-on-surface">Đã xuất</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soldPlants.map((plant) => (
              <PlantListItem key={plant.id} plant={plant} variant="sold" />
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl text-on-primary shadow-leaf active:scale-95 md:hidden"
        aria-label="Thêm cây"
      >
        +
      </button>

      <AddPlantDialog open={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </>
  )
}

function EmptyGarden({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="text-5xl" aria-hidden="true">
        🪴
      </span>
      <div>
        <p className="font-serif text-2xl text-primary">Vườn đang trống</p>
        <p className="mt-1 text-sm text-on-surface-variant">Thêm cây đầu tiên để bắt đầu nhật ký lá.</p>
      </div>
      <button type="button" onClick={onAdd} className="btn-primary">
        + Thêm cây
      </button>
    </div>
  )
}

function GardenSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đang tải">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="card flex gap-3 p-3">
          <div className="h-20 w-20 animate-pulse rounded-2xl bg-surface-container" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-container" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface-container" />
          </div>
        </div>
      ))}
    </div>
  )
}
