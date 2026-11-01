'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon, CollectionIcon, CrownIcon, ScissorsIcon, SparkleIcon, TrashIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { formatDate, formatVarRatio, getPlantLine, type LeafCutout, type Plant } from '@/lib/garden'
import { useDeleteLeafCutout, useLeafCutouts, usePlants } from '@/lib/queries'
import { useLocalStorageState } from '@/lib/use-local-storage'
import { PlantTitle } from '@/components/scientific-name'
import { getPlantDisplayName } from '@/lib/plant-names'

type SortMode = 'var' | 'newest'
const SORT_MODES = ['var', 'newest'] as const

type Item = { cutout: LeafCutout; plant: Plant; takenAt: string | null }
type Line = {
  key: string
  title: string
  display: ReturnType<typeof getPlantLine>['display']
  subtitle: string | null
  items: Item[]
  bestVar: number | null
}

const sortItems = (items: Item[], mode: SortMode) =>
  [...items].sort((left, right) =>
    mode === 'var'
      ? (right.cutout.var_ratio ?? -1) - (left.cutout.var_ratio ?? -1)
      : new Date(right.takenAt ?? right.cutout.created_at).getTime() -
        new Date(left.takenAt ?? left.cutout.created_at).getTime(),
  )

export function CollectionView() {
  const plantsQuery = usePlants()
  const cutoutsQuery = useLeafCutouts()
  const [sortMode, setSortMode] = useLocalStorageState<SortMode>('dg.collectionSort', 'var', SORT_MODES)
  const [lineFilter, setLineFilter] = useState<string>('all')
  const [viewing, setViewing] = useState<Item | null>(null)

  const lines = useMemo<Line[]>(() => {
    const plantsById = new Map((plantsQuery.data ?? []).map((plant) => [plant.id, plant]))
    const groups = new Map<string, Line>()
    for (const cutout of cutoutsQuery.data ?? []) {
      const plant = plantsById.get(cutout.plant_id)
      if (!plant) continue
      const { key, title, display } = getPlantLine(plant)
      const takenAt = plant.timeline_entries.find((entry) => entry.id === cutout.entry_id)?.taken_at ?? null
      let line = groups.get(key)
      if (!line) {
        line = {
          key,
          title,
          display,
          subtitle: display.vernacular,
          items: [],
          bestVar: null,
        }
        groups.set(key, line)
      }
      line.items.push({ cutout, plant, takenAt })
      if (cutout.var_ratio != null && (line.bestVar == null || cutout.var_ratio > line.bestVar)) {
        line.bestVar = cutout.var_ratio
      }
    }
    return [...groups.values()]
      .map((line) => ({ ...line, items: sortItems(line.items, sortMode) }))
      .sort((left, right) => right.items.length - left.items.length || left.title.localeCompare(right.title, 'vi'))
  }, [plantsQuery.data, cutoutsQuery.data, sortMode])

  const visibleLines = lineFilter === 'all' ? lines : lines.filter((line) => line.key === lineFilter)
  const totalLeaves = lines.reduce((sum, line) => sum + line.items.length, 0)
  const topVar = lines.reduce<number | null>(
    (best, line) => (line.bestVar != null && (best == null || line.bestVar > best) ? line.bestVar : best),
    null,
  )

  if (plantsQuery.isPending || cutoutsQuery.isPending) {
    return (
      <div aria-busy="true" aria-label="Đang tải">
        <div className="skeleton mb-8 h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="skeleton aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  const error = plantsQuery.error ?? cutoutsQuery.error
  if (error) {
    return (
      <div className="card p-8 text-center text-on-surface-variant">
        Không tải được bộ sưu tập: {error.message}
        <p className="mt-2 text-xs text-outline">
          Nếu vừa cập nhật app, hãy chạy migration <code>supabase/migrations/0002_leaf_collection.sql</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <section className="relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f3fbf6] via-surface-container-lowest to-secondary-container/60 p-6 shadow-leaf ring-1 ring-surface-container-high/60 md:p-8">
        <CollectionIcon className="pointer-events-none absolute -top-6 -right-4 h-44 w-44 rotate-12 text-primary/5" />
        <p className="eyebrow">Tiêu bản</p>
        <h1 className="font-serif text-3xl font-semibold text-on-surface md:text-4xl">Bộ sưu tập lá</h1>
        <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
          Những chiếc lá đẹp nhất của từng dòng, đã tách nền — so sánh độ phủ var và form lá qua thời gian.
        </p>
        <dl className="mt-5 flex flex-wrap gap-2">
          <Stat label="Dòng" value={String(lines.length)} />
          <Stat label="Tiêu bản lá" value={String(totalLeaves)} />
          <Stat label="Var cao nhất" value={formatVarRatio(topVar)} />
        </dl>
      </section>

      {lines.length === 0 ? (
        <EmptyCollection />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
              <button type="button" className="chip" aria-pressed={lineFilter === 'all'} onClick={() => setLineFilter('all')}>
                Tất cả
              </button>
              {lines.map((line) => (
                <button
                  key={line.key}
                  type="button"
                  className="chip"
                  aria-pressed={lineFilter === line.key}
                  onClick={() => setLineFilter(line.key)}
                >
                  {line.title}
                  <span className="text-xs opacity-70">{line.items.length}</span>
                </button>
              ))}
            </div>
            <div className="flex shrink-0 self-start rounded-full bg-surface-container-low p-1 text-sm font-semibold sm:self-auto" role="radiogroup">
              {SORT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={sortMode === mode}
                  onClick={() => setSortMode(mode)}
                  className={`min-h-9 rounded-full px-4 transition-colors ${
                    sortMode === mode ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {mode === 'var' ? 'Var cao nhất' : 'Mới nhất'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-12">
            {visibleLines.map((line) => (
              <section key={line.key}>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-2xl font-semibold text-on-surface">
                      <PlantTitle display={line.display} />
                    </h2>
                    {line.subtitle ? <p className="truncate text-sm text-outline">{line.subtitle}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-on-surface-variant">
                    {line.items.length} lá · var tối đa{' '}
                    <strong className="text-primary">{formatVarRatio(line.bestVar)}</strong>
                  </p>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                  {line.items.map((item, index) => (
                    <li key={item.cutout.id}>
                      <LeafCard
                        item={item}
                        isBest={sortMode === 'var' && index === 0 && line.items.length > 1}
                        index={index}
                        onOpen={() => setViewing(item)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <LeafViewer item={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-2xl bg-surface-container-lowest/80 px-4 py-2.5 ring-1 ring-surface-container-high">
      <dt className="text-[11px] font-semibold text-on-surface-variant">{label}</dt>
      <dd className="font-serif text-xl font-semibold text-primary">{value}</dd>
    </div>
  )
}

/** Nền "giấy tiêu bản": gradient mềm để lá nổi khối. */
const SPECIMEN_BG =
  'bg-[radial-gradient(120%_90%_at_50%_35%,#ffffff_0%,#eef6f1_55%,#dcebe3_100%)]'

function LeafCard({ item, isBest, index, onOpen }: { item: Item; isBest: boolean; index: number; onOpen: () => void }) {
  const { cutout, plant, takenAt } = item
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group card relative block w-full animate-fade-up overflow-hidden text-left transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-leaf-lg ${
        isBest ? 'ring-2 ring-primary-fixed-dim' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className={`relative aspect-[4/5] p-4 ${SPECIMEN_BG}`}>
        <PlantPhoto
          path={cutout.thumb_path ?? cutout.cutout_path}
          alt={`Lá ${plant.name}`}
          fit="contain"
          className="h-full w-full !bg-transparent drop-shadow-[0_14px_18px_rgba(0,50,30,0.28)] transition-transform duration-500 group-hover:scale-105"
        />
        <span className="pill absolute top-2.5 left-2.5 bg-primary text-on-primary shadow">
          <SparkleIcon className="h-3 w-3" /> {formatVarRatio(cutout.var_ratio)}
        </span>
        {isBest ? (
          <span className="pill absolute top-2.5 right-2.5 bg-primary-fixed text-primary shadow">
            <CrownIcon className="h-3 w-3" /> Đẹp nhất
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate font-serif text-sm font-semibold text-on-surface">{plant.name}</p>
        <p className="text-[11px] text-on-surface-variant">{formatDate(takenAt ?? cutout.created_at)}</p>
      </div>
    </button>
  )
}

function LeafViewer({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteCutout = useDeleteLeafCutout()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (item && !dialog.open) dialog.showModal()
    else if (!item && dialog.open) dialog.close()
  }, [item])

  const handleDelete = () => {
    if (item && window.confirm('Gỡ chiếc lá này khỏi bộ sưu tập? Ảnh gốc trong Nhật ký vẫn được giữ.')) {
      deleteCutout.mutate(item.cutout, { onSuccess: onClose })
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] bg-surface-container-lowest p-0 text-on-surface shadow-leaf-lg backdrop:bg-[#001a10]/55 backdrop:backdrop-blur-sm open:animate-fade-up sm:m-auto sm:max-w-3xl sm:rounded-[2rem]"
    >
      {item ? (
        <div className="grid max-h-[92dvh] overflow-y-auto sm:grid-cols-[1.3fr_1fr]">
          <div className={`relative flex aspect-[4/5] items-center justify-center p-6 sm:aspect-auto sm:min-h-[32rem] ${SPECIMEN_BG}`}>
            <PlantPhoto
              path={item.cutout.cutout_path}
              placeholderPath={item.cutout.thumb_path}
              alt={`Lá ${item.plant.name}`}
              fit="contain"
              priority
              className="h-full w-full !bg-transparent drop-shadow-[0_20px_26px_rgba(0,50,30,0.3)]"
            />
            <button
              type="button"
              onClick={onClose}
              className="btn-icon absolute top-3 right-3 bg-white/80 backdrop-blur sm:hidden"
              aria-label="Đóng"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex flex-col gap-4 p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:p-6">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Bộ sưu tập lá</p>
                <h2 className="font-serif text-2xl font-semibold text-on-surface">
                  <PlantTitle display={getPlantDisplayName(item.plant)} />
                </h2>
                {getPlantDisplayName(item.plant).vernacular ? (
                  <p className="text-sm text-outline">{getPlantDisplayName(item.plant).vernacular}</p>
                ) : null}
              </div>
              <button type="button" onClick={onClose} className="btn-icon -mr-2 hidden sm:inline-flex" aria-label="Đóng">
                <CloseIcon />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary-container/50 px-4 py-3">
                <dt className="text-[11px] font-semibold text-on-surface-variant">Var ước tính</dt>
                <dd className="font-serif text-2xl font-semibold text-primary">{formatVarRatio(item.cutout.var_ratio)}</dd>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                <dt className="text-[11px] font-semibold text-on-surface-variant">Ngày chụp</dt>
                <dd className="font-serif text-lg font-semibold text-on-surface">
                  {formatDate(item.takenAt ?? item.cutout.created_at)}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-outline">
              % var được ước tính từ màu trong vùng lá (trắng, kem, vàng) — phụ thuộc ánh sáng khi chụp, dùng để so sánh
              tương đối giữa các lá.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/plants/${item.plant.id}`} className="btn-secondary flex-1">
                Xem nhật ký
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteCutout.isPending}
                className="btn-ghost bg-error-container text-on-error-container hover:bg-error hover:text-on-error"
              >
                <TrashIcon /> {deleteCutout.isPending ? 'Đang gỡ…' : 'Gỡ'}
              </button>
            </div>
            {deleteCutout.error ? <p className="text-sm text-error">{deleteCutout.error.message}</p> : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

function EmptyCollection() {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex h-20 w-20 animate-sway items-center justify-center rounded-full bg-secondary-container text-4xl text-primary">
        <ScissorsIcon />
      </span>
      <div>
        <p className="font-serif text-2xl font-semibold text-primary">Chưa có tiêu bản lá</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
          Mở Nhật ký của một mẫu cây, bấm biểu tượng kéo <ScissorsIcon className="inline align-[-0.15em]" /> trên ảnh
          rồi chạm vào chiếc lá đẹp nhất — AI sẽ tách lá khỏi nền và đưa vào bộ sưu tập theo dòng.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Mở Kho cây
      </Link>
    </div>
  )
}
