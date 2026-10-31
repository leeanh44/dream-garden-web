'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { LeafIcon, LeafPlusIcon } from '@/components/icons'
import { Modal } from '@/components/modal'
import {
  VND_INPUT_PLACEHOLDER,
  formatPriceInput,
  parseVndAmount,
  toDateInputValue,
} from '@/lib/garden'
import { useCreatePlant } from '@/lib/queries'

export function AddPlantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Thêm cây" icon={<LeafIcon className="h-6 w-6" />}>
      <AddPlantForm onClose={onClose} />
    </Modal>
  )
}

function AddPlantForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const createPlant = useCreatePlant()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(() => toDateInputValue(new Date()))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    createPlant.mutate(
      {
        name: name.trim(),
        purchase_price: parseVndAmount(price),
        purchased_at: purchasedAt || null,
      },
      {
        onSuccess: ({ id }) => {
          onClose()
          router.push(`/plants/${id}`)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="-mt-2 text-sm text-on-surface-variant">Sau khi nhập kho, có thể ghi nhận ảnh lá vào Nhật ký ngay.</p>
      <label className="block">
        <span className="field-label">Tên cây</span>
        <input
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field-input"
          placeholder="Monstera Thai Constellation"
        />
      </label>

      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <label className="block">
          <span className="field-label">Giá nhập (₫)</span>
          <input
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(formatPriceInput(event.target.value))}
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
      </div>

      {createPlant.error ? (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          {createPlant.error.message}
        </p>
      ) : null}

      <button type="submit" disabled={createPlant.isPending || !name.trim()} className="btn-primary w-full">
        {createPlant.isPending ? (
          'Đang lưu…'
        ) : (
          <>
            <LeafPlusIcon className="h-6 w-6 text-primary-fixed" /> Nhập kho
          </>
        )}
      </button>
    </form>
  )
}
