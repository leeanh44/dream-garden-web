'use client'

import { memo, useRef, useState, type ChangeEvent } from 'react'
import { PlantPhoto } from '@/components/plant-photo'
import { formatDate, getDaysSinceDate, toDateInputValue, type Plant, type TimelineEntry } from '@/lib/garden'
import {
  useAddTimelinePhotos,
  useDeleteTimelineEntry,
  useUpdateTimelineEntry,
  type UploadProgress,
} from '@/lib/queries'

export function TimelineTab({ plant }: { plant: Plant }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const addPhotos = useAddTimelinePhotos(plant.id)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const entries = plant.timeline_entries

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) {
      return
    }
    setUploadErrors([])
    addPhotos.mutate(
      { files, onProgress: setProgress },
      {
        onSuccess: ({ errors }) => setUploadErrors(errors),
        onError: (error) => setUploadErrors([error.message]),
        onSettled: () => setProgress(null),
      },
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={handleFiles}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={addPhotos.isPending}
          className="btn-primary"
        >
          {progress ? `Đang tải ${progress.done}/${progress.total}…` : '📷 Thêm ảnh lá'}
        </button>
        <button
          type="button"
          disabled
          className="btn-secondary"
          title="Giai đoạn 2 — dựng video timelapse từ Nhật ký lá"
        >
          🎬 Tạo video <span className="text-xs font-normal">(sắp có)</span>
        </button>
      </div>

      {progress ? (
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      ) : null}

      {uploadErrors.length > 0 ? (
        <ul className="mb-6 space-y-1 rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          {uploadErrors.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}

      {entries.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-serif text-xl text-primary">Chưa có ảnh lá</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Thêm ảnh để bắt đầu nhật ký. Ngày chụp được đọc tự động từ EXIF.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-6 border-l border-dashed border-outline-variant pl-6">
          {entries.map((entry, index) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              plantName={plant.name}
              leafNumber={entries.length - index}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

const TimelineEntryCard = memo(function TimelineEntryCard({
  entry,
  plantName,
  leafNumber,
}: {
  entry: TimelineEntry
  plantName: string
  leafNumber: number
}) {
  const updateEntry = useUpdateTimelineEntry()
  const deleteEntry = useDeleteTimelineEntry()
  const [isEditing, setIsEditing] = useState(false)
  const [note, setNote] = useState(entry.note ?? '')
  const [takenAt, setTakenAt] = useState(() => toDateInputValue(entry.taken_at))
  const daysAgo = getDaysSinceDate(new Date(entry.taken_at))

  const handleSave = () => {
    const original = new Date(entry.taken_at)
    const [year, month, day] = takenAt.split('-').map(Number)
    // Giữ nguyên giờ chụp, chỉ đổi ngày
    const nextTakenAt = new Date(original)
    nextTakenAt.setFullYear(year, month - 1, day)

    updateEntry.mutate(
      { id: entry.id, note: note.trim() || null, taken_at: nextTakenAt.toISOString() },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  const handleDelete = () => {
    if (window.confirm('Xóa ảnh lá này khỏi nhật ký?')) {
      deleteEntry.mutate(entry)
    }
  }

  return (
    <li className="relative">
      <span
        className="absolute top-4 -left-[33px] h-4 w-4 rounded-full border-4 border-surface bg-primary"
        aria-hidden="true"
      />
      <article className="card overflow-hidden">
        <PlantPhoto
          path={entry.photo_path}
          alt={`${plantName} — lá #${leafNumber}, ${formatDate(entry.taken_at)}`}
          className="max-h-[70vh] w-full bg-surface-container-low object-contain"
        />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
              {formatDate(entry.taken_at)}
            </span>
            <span className="text-xs text-outline">
              Lá #{leafNumber} · {daysAgo <= 0 ? 'hôm nay' : `${daysAgo} ngày trước`}
            </span>
            <div className="ml-auto flex gap-1">
              <button type="button" onClick={() => setIsEditing((value) => !value)} className="btn-ghost">
                {isEditing ? 'Hủy' : '✏️ Ghi chú'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
                className="btn-ghost text-error"
                aria-label="Xóa ảnh"
              >
                🗑
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="field-label">Ngày chụp</span>
                <input
                  type="date"
                  value={takenAt}
                  onChange={(event) => setTakenAt(event.target.value)}
                  className="field-input"
                  required
                />
              </label>
              <label className="block">
                <span className="field-label">Ghi chú</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="field-input resize-y"
                  placeholder="Lá mới bung, var đẹp…"
                />
              </label>
              {updateEntry.error ? (
                <p className="text-sm text-error">{updateEntry.error.message}</p>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={updateEntry.isPending || !takenAt}
                className="btn-primary"
              >
                {updateEntry.isPending ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          ) : entry.note ? (
            <p className="mt-3 text-sm whitespace-pre-line text-on-surface-variant">{entry.note}</p>
          ) : null}
        </div>
      </article>
    </li>
  )
})
