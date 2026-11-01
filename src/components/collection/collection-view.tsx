'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon, CollectionIcon, StarIcon, StarLineIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { PlantTitle } from '@/components/scientific-name'
import { formatDate, getPlantLine, type Plant, type TimelineEntry } from '@/lib/garden'
import { getPlantDisplayName } from '@/lib/plant-names'
import { usePlants, useToggleFeatured } from '@/lib/queries'

type Item = { entry: TimelineEntry; plant: Plant }
type Line = {
  key: string
  title: string
  display: ReturnType<typeof getPlantLine>['display']
  subtitle: string | null
  items: Item[]
}

const featuredTime = (entry: TimelineEntry) => new Date(entry.featured_at ?? entry.taken_at).getTime()

/** Bộ sưu tập: những ảnh đẹp nhất (gắn sao trong Nhật ký), gom theo dòng cây. */
export function CollectionView() {
  const plantsQuery = usePlants()
  const [lineFilter, setLineFilter] = useState<string>('all')
  const [viewingId, setViewingId] = useState<string | null>(null)

  const lines = useMemo<Line[]>(() => {
    const groups = new Map<string, Line>()
    for (const plant of plantsQuery.data ?? []) {
      const featured = plant.timeline_entries.filter((entry) => entry.featured_at)
      if (featured.length === 0) continue
      const { key, title, display } = getPlantLine(plant)
      let line = groups.get(key)
      if (!line) {
        line = { key, title, display, subtitle: display.vernacular, items: [] }
        groups.set(key, line)
      }
      line.items.push(...featured.map((entry) => ({ entry, plant })))
    }
    return [...groups.values()]
      .map((line) => ({ ...line, items: line.items.sort((a, b) => featuredTime(b.entry) - featuredTime(a.entry)) }))
      .sort((left, right) => featuredTime(right.items[0].entry) - featuredTime(left.items[0].entry))
  }, [plantsQuery.data])

  const allItems = useMemo(() => lines.flatMap((line) => line.items), [lines])
  const viewing = allItems.find((item) => item.entry.id === viewingId) ?? null
  const activeFilter = lines.some((line) => line.key === lineFilter) ? lineFilter : 'all'
  const visibleLines = activeFilter === 'all' ? lines : lines.filter((line) => line.key === activeFilter)
  const plantCount = new Set(allItems.map((item) => item.plant.id)).size

  if (plantsQuery.isPending) {
    return (
      <div aria-busy="true" aria-label="Đang tải">
        <div className="skeleton mb-8 h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="skeleton aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  if (plantsQuery.error) {
    return <div className="card p-8 text-center text-on-surface-variant">Không tải được bộ sưu tập: {plantsQuery.error.message}</div>
  }

  return (
    <div className="animate-fade-in">
      <section className="relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f3fbf6] via-surface-container-lowest to-secondary-container/60 p-6 shadow-leaf ring-1 ring-surface-container-high/60 md:p-8">
        <CollectionIcon className="pointer-events-none absolute -top-6 -right-4 h-44 w-44 rotate-12 text-primary/5" />
        <p className="eyebrow">Tuyển tập</p>
        <h1 className="font-serif text-3xl font-semibold text-on-surface md:text-4xl">Bộ sưu tập</h1>
        <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
          Những khoảnh khắc đẹp nhất của từng mẫu cây — gắn sao ảnh trong Nhật ký để lưu vào đây.
        </p>
        <dl className="mt-5 flex flex-wrap gap-2">
          <Stat label="Ảnh" value={String(allItems.length)} />
          <Stat label="Mẫu cây" value={String(plantCount)} />
          <Stat label="Dòng" value={String(lines.length)} />
        </dl>
      </section>

      {lines.length === 0 ? (
        <EmptyCollection />
      ) : (
        <>
          {lines.length > 1 ? (
            <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
              <button type="button" className="chip" aria-pressed={activeFilter === 'all'} onClick={() => setLineFilter('all')}>
                Tất cả
              </button>
              {lines.map((line) => (
                <button
                  key={line.key}
                  type="button"
                  className="chip"
                  aria-pressed={activeFilter === line.key}
                  onClick={() => setLineFilter(line.key)}
                >
                  <PlantTitle display={line.display} />
                  <span className="text-xs opacity-70">{line.items.length}</span>
                </button>
              ))}
            </div>
          ) : null}

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
                  <p className="shrink-0 text-xs text-on-surface-variant">{line.items.length} ảnh</p>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {line.items.map((item, index) => (
                    <li key={item.entry.id}>
                      <PhotoCard item={item} index={index} onOpen={() => setViewingId(item.entry.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <PhotoDetail item={viewing} onClose={() => setViewingId(null)} />
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

function PhotoCard({ item, index, onOpen }: { item: Item; index: number; onOpen: () => void }) {
  const { entry, plant } = item
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group card relative block w-full animate-fade-up overflow-hidden text-left transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-leaf-lg"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <PlantPhoto
        path={entry.thumb_path ?? entry.photo_path}
        alt={`${plant.name} — ${formatDate(entry.taken_at)}`}
        className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pt-10 pb-2.5 text-white">
        <p className="truncate font-serif text-sm font-semibold">{plant.name}</p>
        <p className="text-[11px] text-white/75">{formatDate(entry.taken_at)}</p>
      </div>
    </button>
  )
}

function PhotoDetail({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const toggleFeatured = useToggleFeatured()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (item && !dialog.open) dialog.showModal()
    else if (!item && dialog.open) dialog.close()
  }, [item])

  const display = item ? getPlantDisplayName(item.plant) : null

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] bg-surface-container-lowest p-0 text-on-surface shadow-leaf-lg backdrop:bg-[#001a10]/55 backdrop:backdrop-blur-sm open:animate-fade-up sm:m-auto sm:max-w-3xl sm:rounded-[2rem]"
    >
      {item && display ? (
        <div className="grid max-h-[92dvh] overflow-y-auto sm:grid-cols-[1.3fr_1fr]">
          <div className="relative bg-[#0b1a12]">
            <PlantPhoto
              path={item.entry.photo_path}
              placeholderPath={item.entry.thumb_path}
              alt={`${item.plant.name} — ${formatDate(item.entry.taken_at)}`}
              fit="contain"
              priority
              className="aspect-[4/5] w-full !bg-transparent sm:aspect-auto sm:h-full sm:min-h-[32rem]"
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
                <p className="eyebrow">Bộ sưu tập</p>
                <h2 className="font-serif text-2xl font-semibold text-on-surface">
                  <PlantTitle display={display} />
                </h2>
                {display.vernacular ? <p className="text-sm text-outline">{display.vernacular}</p> : null}
              </div>
              <button type="button" onClick={onClose} className="btn-icon -mr-2 hidden sm:inline-flex" aria-label="Đóng">
                <CloseIcon />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary-container/50 px-4 py-3">
                <dt className="text-[11px] font-semibold text-on-surface-variant">Ngày chụp</dt>
                <dd className="font-serif text-lg font-semibold text-primary">{formatDate(item.entry.taken_at)}</dd>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-3">
                <dt className="text-[11px] font-semibold text-on-surface-variant">Lưu ngày</dt>
                <dd className="font-serif text-lg font-semibold text-on-surface">
                  {formatDate(item.entry.featured_at ?? item.entry.taken_at)}
                </dd>
              </div>
            </dl>
            {item.entry.note ? (
              <p className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm whitespace-pre-line text-on-surface-variant">
                {item.entry.note}
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/plants/${item.plant.id}`} className="btn-secondary flex-1">
                Xem nhật ký
              </Link>
              <button
                type="button"
                onClick={() => toggleFeatured.mutate({ entry: item.entry, featured: false }, { onSuccess: onClose })}
                disabled={toggleFeatured.isPending}
                className="btn-ghost bg-surface-container"
              >
                <StarLineIcon /> Gỡ khỏi bộ sưu tập
              </button>
            </div>
            {toggleFeatured.error ? <p className="text-sm text-error">{toggleFeatured.error.message}</p> : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

function EmptyCollection() {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex h-20 w-20 animate-sway items-center justify-center rounded-full bg-secondary-container text-4xl text-[#c98a00]">
        <StarIcon />
      </span>
      <div>
        <p className="font-serif text-2xl font-semibold text-primary">Chưa có ảnh nào</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
          Mở Nhật ký của một mẫu cây, bấm ngôi sao <StarLineIcon className="inline align-[-0.15em]" /> trên ảnh đẹp nhất để
          lưu vào bộ sưu tập.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Mở Kho cây
      </Link>
    </div>
  )
}
