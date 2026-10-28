'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
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
    <Modal open={open} onClose={onClose} title="Thêm cây">
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

      <div className="grid grid-cols-2 gap-3">
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
        {createPlant.isPending ? 'Đang lưu…' : 'Thêm vào kho'}
      </button>
    </form>
  )
}
