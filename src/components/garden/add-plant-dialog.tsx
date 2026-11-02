'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { LeafArtIcon, LeafPlusIcon } from '@/components/icons'
import { Modal } from '@/components/modal'
import { PlantNameFields, type PlantNameValues } from '@/components/plant/plant-name-fields'
import {
  VND_INPUT_PLACEHOLDER,
  formatPriceInput,
  parseVndAmount,
  toDateInputValue,
} from '@/lib/garden'
import { useCreatePlant } from '@/lib/queries'

type AddPlantProps = {
  onClose: () => void
  /** Tên gõ sẵn (vd. từ ô tìm kiếm ở Chụp nhanh) */
  initialName?: string
  /** Mặc định: mở trang cây vừa tạo. Truyền vào để tự xử lý (vd. lưu ảnh vào cây mới). */
  onCreated?: (plantId: string) => void
  description?: string
  submitLabel?: string
}

export function AddPlantDialog({ open, ...props }: AddPlantProps & { open: boolean }) {
  return (
    <Modal open={open} onClose={props.onClose} title="Thêm cây" plainIcon icon={<LeafArtIcon className="-my-2 h-14 w-14" />}>
      <AddPlantForm {...props} />
    </Modal>
  )
}

function AddPlantForm({
  onClose,
  initialName = '',
  onCreated,
  description = 'Sau khi nhập kho, có thể ghi nhận ảnh lá vào Nhật ký ngay.',
  submitLabel = 'Nhập kho',
}: AddPlantProps) {
  const router = useRouter()
  const createPlant = useCreatePlant()
  const [names, setNames] = useState<PlantNameValues>({ name: initialName, scientific: '', cultivar: '' })
  const [price, setPrice] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(() => toDateInputValue(new Date()))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    createPlant.mutate(
      {
        name: names.name.trim(),
        scientific_name: names.scientific.trim() || null,
        cultivar: names.cultivar.trim() || null,
        purchase_price: parseVndAmount(price),
        purchased_at: purchasedAt || null,
      },
      {
        onSuccess: ({ id }) => {
          onClose()
          if (onCreated) {
            onCreated(id)
          } else {
            router.push(`/plants/${id}`)
          }
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="-mt-2 text-sm text-on-surface-variant">{description}</p>
      <PlantNameFields values={names} onChange={setNames} autoFocus />

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

      <button type="submit" disabled={createPlant.isPending || !names.name.trim()} className="btn-primary w-full">
        {createPlant.isPending ? (
          'Đang lưu…'
        ) : (
          <>
            <LeafPlusIcon className="h-8 w-8" /> {submitLabel}
          </>
        )}
      </button>
    </form>
  )
}
