'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { HoverInfo } from '@/components/garden3d/garden-scene'
import { CubeIcon } from '@/components/icons'
import { RANK_PILL_CLASSES } from '@/lib/garden'
import { toPlants3D } from '@/lib/garden3d'
import { usePlants } from '@/lib/queries'
import { useResolvedTheme } from '@/lib/use-theme'

// three.js (~600KB) chỉ tải khi mở trang này, và không chạy trên server
const GardenCanvas = dynamic(() => import('@/components/garden3d/garden-canvas'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" aria-hidden="true" />,
})

const LEGEND = [
  'Cây cao, lá to = hạng cao',
  'Số lá = số ảnh trong Nhật ký',
  'Lá rủ = lâu chưa chụp',
  'Chậu men kem = Top 1',
]

/** Vườn 3D: toàn bộ cây đang có, dựng thành nhà kính xoay / phóng to được. */
export function Garden3DView() {
  const plantsQuery = usePlants()
  const router = useRouter()
  const theme = useResolvedTheme()
  const [hover, setHover] = useState<HoverInfo>(null)

  const plants = useMemo(() => toPlants3D(plantsQuery.data ?? []), [plantsQuery.data])
  const hovered = hover ? plants.find((plant) => plant.id === hover.id) : undefined
  const leafCount = plants.reduce((sum, plant) => sum + plant.photoCount, 0)
  const staleCount = plants.filter((plant) => plant.isStale).length

  if (plantsQuery.error) {
    return <div className="card p-8 text-center text-on-surface-variant">Không tải được vườn: {plantsQuery.error.message}</div>
  }

  return (
    <div className="animate-fade-in">
      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-surface-container-lowest p-6 shadow-leaf ring-1 ring-surface-container-high md:p-8">
        <CubeIcon className="pointer-events-none absolute -top-6 -right-4 h-44 w-44 rotate-12 text-primary/5" />
        <p className="eyebrow">Nhà kính</p>
        <h1 className="font-serif text-3xl font-semibold text-on-surface md:text-4xl">Vườn 3D</h1>
        <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
          Kéo để xoay, cuộn hoặc chụm hai ngón để phóng to. Chạm vào một chậu để xem cây.
        </p>
        <dl className="mt-5 flex flex-wrap gap-2">
          <Stat label="Cây" value={plantsQuery.isPending ? '—' : String(plants.length)} />
          <Stat label="Lá đã chụp" value={plantsQuery.isPending ? '—' : String(leafCount)} />
          <Stat label="Cần chụp lại" value={plantsQuery.isPending ? '—' : String(staleCount)} />
        </dl>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
          {LEGEND.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="relative h-[min(72vh,720px)] min-h-[420px] overflow-hidden rounded-[2rem] bg-surface-container shadow-leaf ring-1 ring-surface-container-high">
        {plantsQuery.isPending ? (
          <div className="skeleton h-full w-full" aria-busy="true" aria-label="Đang tải" />
        ) : plants.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-on-surface-variant">Nhà kính còn trống — thêm cây đầu tiên để thấy nó mọc lên ở đây.</p>
            <Link href="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">
              Về Kho cây
            </Link>
          </div>
        ) : (
          <>
            <GardenCanvas
              plants={plants}
              theme={theme}
              onHover={setHover}
              onSelect={(id) => router.push(`/plants/${id}`)}
            />
            {hover && hovered && (
              <div
                className={`absolute z-10 w-56 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-2xl bg-surface-container-lowest/95 p-3 shadow-leaf-lg ring-1 ring-outline-variant backdrop-blur ${
                  hover.pinned ? '' : 'pointer-events-none'
                }`}
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 font-semibold text-on-surface">{hovered.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${RANK_PILL_CLASSES[hovered.tier]}`}>
                    {hovered.rankScore}/10
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {hovered.photoCount} ảnh ·{' '}
                  {hovered.isStale ? `${hovered.daysSincePhoto} ngày chưa chụp` : `chụp ${hovered.daysSincePhoto} ngày trước`}
                </p>
                {hover.pinned ? (
                  <Link
                    href={`/plants/${hovered.id}`}
                    className="mt-2 block rounded-full bg-primary py-2 text-center text-xs font-semibold text-on-primary"
                  >
                    Xem cây
                  </Link>
                ) : (
                  <p className="mt-1.5 text-[11px] font-semibold text-primary">Bấm để xem cây</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Danh sách cho trình đọc màn hình / bàn phím — cảnh 3D không truy cập được */}
      <ul className="sr-only">
        {plants.map((plant) => (
          <li key={plant.id}>
            <Link href={`/plants/${plant.id}`}>
              {plant.name}, hạng {plant.rankScore}, {plant.photoCount} ảnh
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-2 ring-1 ring-surface-container-high">
      <dt className="text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">{label}</dt>
      <dd className="font-serif text-xl font-semibold text-on-surface">{value}</dd>
    </div>
  )
}
