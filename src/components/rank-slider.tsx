'use client'

import {
  PLANT_RANK_MAX,
  PLANT_RANK_MIN,
  RANK_PILL_CLASSES,
  getPlantRankTier,
} from '@/lib/garden'

const TIER_LABELS = { top1: 'Top 1', top2: 'Top 2', top3: 'Top 3' } as const

export function RankSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const tier = getPlantRankTier(value)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="field-label mb-0">Đánh giá chất lượng</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${RANK_PILL_CLASSES[tier]}`}>
          ★ {value} · {TIER_LABELS[tier]}
        </span>
      </div>
      <input
        type="range"
        min={PLANT_RANK_MIN}
        max={PLANT_RANK_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label="Điểm đánh giá 1–10"
      />
      <div className="mt-1 flex justify-between text-[11px] text-outline">
        <span>{PLANT_RANK_MIN}</span>
        <span>{PLANT_RANK_MAX}</span>
      </div>
    </div>
  )
}
