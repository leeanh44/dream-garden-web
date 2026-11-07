'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { CloseIcon, ShuffleIcon, SparkleIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { PlantTitle } from '@/components/scientific-name'
import { formatDate, getDaysSinceDate, type Plant } from '@/lib/garden'
import { getPlantDisplayName } from '@/lib/plant-names'
import {
  entryThumb,
  getFreshMilestones,
  getLookBackCandidates,
  getMomentCandidates,
  pickLookBack,
  pickMoment,
  type Milestone,
} from '@/lib/moments'

// ---------------------------------------------------------------------------
// Phiên mở app: 1 hạt ngẫu nhiên cố định cho tới khi tải lại trang.
// Chỉ có ở client → server/hydrate render khung chờ, tránh lệch HTML (ngẫu nhiên, giờ địa phương).
// ---------------------------------------------------------------------------

const LAST_MOMENT_KEY = 'dg.moment.last'
const DISMISSED_MILESTONES_KEY = 'dg.milestones.dismissed'

type Session = { seed: number; lastMomentId: string | null }
let session: Session | null = null

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Chỉ là tiện ích — bỏ qua khi không lưu được
  }
}

const getSession = () => {
  session ??= { seed: Math.random(), lastMomentId: readStorage(LAST_MOMENT_KEY) }
  return session
}

const noopSubscribe = () => () => {}

const useSession = () => useSyncExternalStore(noopSubscribe, getSession, () => null)

// Thẻ cột mốc đã đóng
const dismissListeners = new Set<() => void>()
const subscribeDismissed = (listener: () => void) => {
  dismissListeners.add(listener)
  return () => {
    dismissListeners.delete(listener)
  }
}
const useDismissedMilestones = () => {
  const raw = useSyncExternalStore(subscribeDismissed, () => readStorage(DISMISSED_MILESTONES_KEY), () => null)
  return useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw ?? '[]')
      return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
    } catch {
      return new Set<string>()
    }
  }, [raw])
}
const dismissMilestone = (dismissed: Set<string>, key: string) => {
  // Giữ 200 khoá gần nhất là đủ (cột mốc chỉ hiện trong 7 ngày)
  writeStorage(DISMISSED_MILESTONES_KEY, JSON.stringify([...dismissed, key].slice(-200)))
  dismissListeners.forEach((listener) => listener())
}

const formatAgo = (date: string | Date) => {
  const days = getDaysSinceDate(new Date(date))
  if (days <= 0) return 'hôm nay'
  if (days === 1) return 'hôm qua'
  if (days < 30) return `${days} ngày trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

// ---------------------------------------------------------------------------
// Cột mốc
// ---------------------------------------------------------------------------

const milestoneTitle = ({ plant, kind, value }: Milestone) => {
  if (kind === 'leaves') {
    return `${plant.name} vừa ra lá thứ ${value}`
  }
  return value % 365 === 0 ? `${plant.name} tròn ${value / 365} năm theo dõi` : `${plant.name} tròn ${value} ngày theo dõi`
}

/** Thẻ chúc mừng khi cây vừa đạt cột mốc (trong 7 ngày qua), đóng được. */
export function MilestoneCards({ plants }: { plants: Plant[] }) {
  const current = useSession()
  const dismissed = useDismissedMilestones()
  const milestones = useMemo(
    () => (current ? getFreshMilestones(plants, new Date()).filter((item) => !dismissed.has(item.key)).slice(0, 3) : []),
    [current, plants, dismissed],
  )

  if (milestones.length === 0) {
    return null
  }

  return (
    <ul className="mb-8 space-y-2" aria-label="Cột mốc mới">
      {milestones.map((milestone, index) => (
        <li
          key={milestone.key}
          className="flex animate-fade-up items-center gap-3 rounded-3xl bg-primary py-2 pr-2 pl-3 text-on-primary shadow-fab"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-on-primary/15 text-xl">
            <SparkleIcon />
          </span>
          <Link href={`/plants/${milestone.plant.id}`} className="min-w-0 flex-1 py-1">
            <p className="font-serif text-lg leading-tight font-semibold text-balance">{milestoneTitle(milestone)}</p>
            <p className="mt-0.5 text-xs opacity-80">
              {formatDate(milestone.achievedAt)} · Xem hành trình →
            </p>
          </Link>
          <button
            type="button"
            onClick={() => dismissMilestone(dismissed, milestone.key)}
            className="btn-icon text-on-primary hover:bg-on-primary/10 hover:text-on-primary"
            aria-label="Đóng thông báo cột mốc"
          >
            <CloseIcon />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Khoảnh khắc hôm nay + Nhìn lại
// ---------------------------------------------------------------------------

export function GardenMoments({ plants }: { plants: Plant[] }) {
  const current = useSession()
  const [offset, setOffset] = useState(0)

  const momentCandidates = useMemo(() => getMomentCandidates(plants), [plants])
  const moment = current ? pickMoment(momentCandidates, current.seed, offset, current.lastMomentId) : null
  const lookBack = useMemo(
    () => (current ? pickLookBack(getLookBackCandidates(plants, new Date()), current.seed) : null),
    [current, plants],
  )

  // Ghi nhớ ảnh vừa hiện → lần mở sau chọn ảnh khác
  const momentId = moment?.entry.id
  useEffect(() => {
    if (momentId) {
      writeStorage(LAST_MOMENT_KEY, momentId)
    }
  }, [momentId])

  if (momentCandidates.length === 0) {
    return null
  }

  return (
    <div className={`mb-8 grid gap-4 ${lookBack ? 'md:grid-cols-[1.25fr_1fr]' : ''}`}>
      {moment ? (
        <section aria-label="Khoảnh khắc hôm nay" className="relative animate-fade-in overflow-hidden rounded-[2rem] shadow-leaf-lg">
          <Link href={`/plants/${moment.plant.id}`} className="group block">
            <PlantPhoto
              key={moment.entry.id}
              path={moment.entry.photo_path}
              placeholderPath={moment.entry.thumb_path}
              alt={`${moment.plant.name} — ${formatDate(moment.entry.taken_at)}`}
              priority
              deferFull
              className="aspect-[4/5] w-full transition-transform duration-700 group-hover:scale-[1.03] sm:aspect-[16/11]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] text-white/80 uppercase">
                <SparkleIcon /> Khoảnh khắc hôm nay
              </p>
              <p className="mt-2 font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
                <PlantTitle display={getPlantDisplayName(moment.plant)} />
              </p>
              <p className="mt-1 text-sm text-white/80">
                {formatDate(moment.entry.taken_at)} · {formatAgo(moment.entry.taken_at)}
              </p>
            </div>
          </Link>
          {momentCandidates.length > 1 ? (
            <button
              type="button"
              onClick={() => setOffset((value) => value + 1)}
              className="absolute top-4 right-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-black/45 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/60"
            >
              <ShuffleIcon /> Lá khác
            </button>
          ) : null}
        </section>
      ) : (
        <div className="skeleton aspect-[4/5] rounded-[2rem] sm:aspect-[16/11]" aria-hidden="true" />
      )}

      {lookBack ? (
        <Link
          href={`/plants/${lookBack.plant.id}`}
          className="card group flex animate-fade-in flex-col p-4 transition-shadow hover:shadow-leaf-lg sm:p-5"
          aria-label={`Nhìn lại ${lookBack.plant.name}: ${lookBack.label} và hiện tại`}
        >
          <p className="eyebrow">Nhìn lại · {lookBack.label}</p>
          <p className="mt-1 truncate font-serif text-2xl font-semibold text-on-surface">
            <PlantTitle display={getPlantDisplayName(lookBack.plant)} />
          </p>
          <div className="mt-4 grid flex-1 grid-cols-2 gap-2">
            {[
              { entry: lookBack.then, caption: lookBack.label === 'Ngày đầu tiên' ? 'Ngày đầu' : lookBack.label },
              { entry: lookBack.now, caption: 'Mới nhất' },
            ].map(({ entry, caption }) => (
              <figure key={entry.id} className="flex min-h-0 flex-col gap-1.5">
                <PlantPhoto
                  path={entryThumb(entry)}
                  alt={`${lookBack.plant.name} — ${formatDate(entry.taken_at)}`}
                  className="aspect-[4/5] w-full flex-1 rounded-2xl"
                />
                <figcaption className="text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">{caption}</span> · {formatDate(entry.taken_at)}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">
            Sau <strong className="text-primary">{lookBack.spanDays} ngày</strong> — bấm để xem cả hành trình →
          </p>
        </Link>
      ) : null}
    </div>
  )
}
