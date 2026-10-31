'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { AddPlantDialog } from '@/components/garden/add-plant-dialog'
import { PlantListItem } from '@/components/garden/plant-list-item'
import { InstallBanner } from '@/components/pwa/install-banner'
import { TopTrending } from '@/components/garden/top-trending'
import {
  AlertIcon,
  CameraIcon,
  ClockIcon,
  LeafIcon,
  LeafPlusIcon,
  SearchIcon,
  SortIcon,
} from '@/components/icons'
import {
  DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
  RANK_FILTER_LABELS,
  formatCompactVnd,
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

  const { activePlants, soldPlants, staleCount, stalePlant, leafCount, totalValue } = useMemo(() => {
    const all = plants ?? []
    const active = all.filter((plant) => !plant.is_sold)
    const stale = active.filter(
      (plant) => getDaysSinceDate(getPlantLastPhotoAt(plant)) >= DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS,
    )
    return {
      leafCount: active.reduce((sum, plant) => sum + plant.timeline_entries.length, 0),
      totalValue: active.reduce((sum, plant) => sum + (plant.market_value ?? 0), 0),
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
      <div className="card flex flex-col items-center p-8 text-center">
        <AlertIcon className="mb-3 text-3xl text-error" />
        <p className="mb-4 text-on-surface-variant">Không tải được dữ liệu kho cây: {error.message}</p>
        <button type="button" onClick={() => refetch()} className="btn-secondary">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <>
      <GardenHero
        plantCount={activePlants.length}
        leafCount={leafCount}
        totalValue={totalValue}
        onAdd={() => setIsAddOpen(true)}
      />

      <InstallBanner />

      {stalePlant ? (
        <Link
          href={`/plants/${stalePlant.id}`}
          className="group mb-8 flex animate-fade-up items-center gap-4 rounded-3xl bg-gradient-to-r from-primary-fixed/50 via-secondary-container/50 to-transparent p-4 ring-1 ring-primary/10 transition-colors hover:from-primary-fixed/70"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl text-on-primary shadow-leaf">
            <CameraIcon />
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug text-on-surface-variant">
            <strong className="text-on-surface">{staleCount} mẫu cây</strong> quá {DEFAULT_PHOTO_UPDATE_SUGGEST_DAYS} ngày
            chưa ghi nhận sinh trưởng. Ưu tiên: <strong className="text-primary">{stalePlant.name}</strong>.
          </span>
          <span className="hidden text-sm font-semibold text-primary transition-transform group-hover:translate-x-1 sm:block">
            Ghi nhận →
          </span>
        </Link>
      ) : null}

      <TopTrending plants={activePlants} />

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Danh mục</p>
            <h2 className="font-serif text-3xl font-semibold text-on-surface">Kho cây</h2>
          </div>
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'name' ? 'createdAt' : 'name')}
            className="btn-ghost -mr-2"
            title="Đổi cách sắp xếp"
          >
            {sortMode === 'name' ? <SortIcon /> : <ClockIcon />}
            {sortMode === 'name' ? 'Tên A–Z' : 'Mới nhập'}
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block md:w-80">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-outline">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="field-input rounded-full pl-11"
              placeholder="Tên cây hoặc tên khoa học…"
              aria-label="Tìm kiếm cây"
            />
          </label>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
            {RANK_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setRankFilter(filter)}
                aria-pressed={rankFilter === filter}
                className="chip"
              >
                {RANK_FILTER_LABELS[filter]}
              </button>
            ))}
          </div>
        </div>

        {activePlants.length === 0 ? (
          <EmptyGarden onAdd={() => setIsAddOpen(true)} />
        ) : visiblePlants.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <SearchIcon className="text-3xl text-outline" />
            <p className="text-on-surface-variant">Không có mẫu cây nào khớp bộ lọc.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {visiblePlants.map((plant, index) => (
              <PlantListItem key={plant.id} plant={plant} index={index} />
            ))}
          </div>
        )}
      </section>

      {soldPlants.length > 0 ? (
        <section className="mt-14">
          <p className="eyebrow">Lưu trữ</p>
          <h2 className="mb-4 font-serif text-2xl font-semibold text-on-surface">Đã xuất · {soldPlants.length}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {soldPlants.map((plant, index) => (
              <PlantListItem key={plant.id} plant={plant} index={index} variant="sold" />
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-20 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-fab transition-transform active:scale-90 md:hidden"
        aria-label="Thêm cây"
        title="Thêm cây"
      >
        <LeafPlusIcon className="h-9 w-9" />
      </button>

      <AddPlantDialog open={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </>
  )
}

function GardenHero({
  plantCount,
  leafCount,
  totalValue,
  onAdd,
}: {
  plantCount: number
  leafCount: number
  totalValue: number
  onAdd: () => void
}) {
  const stats = [
    { label: 'Đang chăm', value: String(plantCount) },
    { label: 'Lượt ghi nhận', value: String(leafCount) },
    { label: 'Định giá', value: totalValue > 0 ? formatCompactVnd(totalValue) : '—' },
  ]

  return (
    <section className="relative mb-8 animate-fade-up overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-container via-primary to-[#002f1e] p-6 text-on-primary shadow-leaf-lg md:p-8">
      {/* Lá trang trí */}
      <LeafIcon className="pointer-events-none absolute -top-8 -right-6 h-48 w-48 rotate-12 text-primary-fixed/10 md:h-64 md:w-64" />
      <LeafIcon className="pointer-events-none absolute -bottom-10 left-1/2 h-32 w-32 -rotate-45 text-primary-fixed/5" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-primary-fixed/80 uppercase">Dream&apos;s Garden</p>
          <h1 className="mt-1 font-serif text-3xl leading-tight font-semibold md:text-4xl">Bộ sưu tập kiểng lá</h1>
          <p className="mt-1 text-sm text-on-primary/70">Theo dõi sinh trưởng, độ ổn định var và giá trị từng mẫu cây.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="hidden min-h-12 items-center gap-2 self-start rounded-full bg-primary-fixed px-5 font-semibold text-primary shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.03] active:scale-[0.97] md:inline-flex md:self-auto"
        >
          <LeafPlusIcon className="h-7 w-7" />
          Thêm cây
        </button>
      </div>

      <dl className="relative mt-6 grid grid-cols-3 gap-2 md:max-w-lg">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/10 backdrop-blur-sm">
            <dt className="truncate text-[11px] font-semibold text-on-primary/70">{stat.label}</dt>
            <dd className="mt-0.5 truncate font-serif text-xl font-semibold md:text-2xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function EmptyGarden({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex h-20 w-20 animate-sway items-center justify-center rounded-full bg-secondary-container text-primary">
        <LeafIcon className="h-10 w-10" />
      </span>
      <div>
        <p className="font-serif text-2xl font-semibold text-primary">Chưa có mẫu cây nào</p>
        <p className="mt-1 text-sm text-on-surface-variant">Nhập mẫu cây đầu tiên để bắt đầu theo dõi sinh trưởng.</p>
      </div>
      <button type="button" onClick={onAdd} className="btn-primary">
        <LeafPlusIcon className="h-7 w-7" />
        Thêm cây
      </button>
    </div>
  )
}

function GardenSkeleton() {
  return (
    <div aria-label="Đang tải" aria-busy="true">
      <div className="skeleton mb-8 h-56 rounded-[2rem] md:h-52" />
      <div className="skeleton mb-4 h-8 w-40 rounded-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card overflow-hidden">
            <div className="skeleton aspect-[4/5]" />
            <div className="space-y-2 p-3">
              <div className="skeleton h-4 w-3/4 rounded-full" />
              <div className="skeleton h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
