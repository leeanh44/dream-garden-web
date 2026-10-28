'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { RankSlider } from '@/components/rank-slider'
import {
  VND_INPUT_PLACEHOLDER,
  formatPriceInput,
  formatVndNumber,
  parseVndAmount,
  type Plant,
} from '@/lib/garden'
import { useDeletePlant, usePlants, useUpdatePlant } from '@/lib/queries'

const toPriceInput = (amount: number | null) => (amount == null ? '' : formatVndNumber(amount))

export function ProfileTab({ plant }: { plant: Plant }) {
  const router = useRouter()
  const { data: plants } = usePlants()
  const updatePlant = useUpdatePlant()
  const deletePlant = useDeletePlant()

  const [name, setName] = useState(plant.name)
  const [scientificName, setScientificName] = useState(plant.scientific_name ?? '')
  const [rankScore, setRankScore] = useState(plant.rank_score)
  const [purchasePrice, setPurchasePrice] = useState(toPriceInput(plant.purchase_price))
  const [purchasedAt, setPurchasedAt] = useState(plant.purchased_at ?? '')
  const [marketValue, setMarketValue] = useState(toPriceInput(plant.market_value))
  const [parentPlantId, setParentPlantId] = useState(plant.parent_plant_id ?? '')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const parentOptions = (plants ?? []).filter((candidate) => candidate.id !== plant.id)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    updatePlant.mutate(
      {
        id: plant.id,
        name: name.trim(),
        scientific_name: scientificName.trim() || null,
        rank_score: rankScore,
        purchase_price: parseVndAmount(purchasePrice),
        purchased_at: purchasedAt || null,
        market_value: parseVndAmount(marketValue),
        parent_plant_id: parentPlantId || null,
      },
      { onSuccess: () => setSavedAt(Date.now()) },
    )
  }

  const handleDelete = () => {
    const leafCount = plant.timeline_entries.length
    const message = `Xóa "${plant.name}"${leafCount > 0 ? ` cùng ${leafCount} ảnh lá` : ''}? Không thể hoàn tác.`
    if (!window.confirm(message)) {
      return
    }
    deletePlant.mutate(plant, { onSuccess: () => router.replace('/') })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <label className="block">
          <span className="field-label">Tên cây</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} className="field-input" />
        </label>

        <label className="block">
          <span className="field-label">Tên khoa học</span>
          <input
            value={scientificName}
            onChange={(event) => setScientificName(event.target.value)}
            className="field-input italic"
            placeholder="Monstera deliciosa 'Thai Constellation'"
          />
          <span className="mt-1 block text-xs text-outline">Dùng để tra thông tin bằng Gemini AI (giai đoạn 3).</span>
        </label>

        <RankSlider value={rankScore} onChange={setRankScore} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Giá nhập (₫)</span>
            <input
              inputMode="numeric"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(formatPriceInput(event.target.value))}
              className="field-input"
              placeholder={VND_INPUT_PLACEHOLDER}
            />
          </label>
          <label className="block">
            <span className="field-label">Ngày nhập</span>
            <input
              type="date"
              value={purchasedAt}
              onChange={(event) => setPurchasedAt(event.target.value)}
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="field-label">Định giá hiện tại (₫)</span>
            <input
              inputMode="numeric"
              value={marketValue}
              onChange={(event) => setMarketValue(formatPriceInput(event.target.value))}
              className="field-input"
              placeholder={VND_INPUT_PLACEHOLDER}
            />
          </label>
          <label className="block">
            <span className="field-label">Cây mẹ</span>
            <select
              value={parentPlantId}
              onChange={(event) => setParentPlantId(event.target.value)}
              className="field-input"
            >
              <option value="">— Không có —</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {updatePlant.error ? (
          <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
            {updatePlant.error.message}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={updatePlant.isPending || !name.trim()} className="btn-primary">
            {updatePlant.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
          {savedAt && !updatePlant.isPending ? (
            <span className="text-sm text-success-green">✓ Đã lưu</span>
          ) : null}
        </div>
      </form>

      <aside className="space-y-4">
        <div className="card space-y-2 p-5 text-sm">
          <p className="font-serif text-lg text-primary">🤖 Thông tin AI</p>
          <p className="text-on-surface-variant">
            Tra Gemini (ánh sáng, tưới nước, độ ẩm, đất trồng…) sẽ có ở giai đoạn 3.
          </p>
        </div>
        <div className="card p-5">
          <p className="mb-3 text-sm text-on-surface-variant">Xóa cây và toàn bộ ảnh lá khỏi kho.</p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePlant.isPending}
            className="btn-ghost w-full bg-error-container text-on-error-container hover:bg-error-container/80"
          >
            {deletePlant.isPending ? 'Đang xóa…' : 'Xóa cây'}
          </button>
          {deletePlant.error ? <p className="mt-2 text-sm text-error">{deletePlant.error.message}</p> : null}
        </div>
      </aside>
    </div>
  )
}
