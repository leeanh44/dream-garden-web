'use client'

import Link from 'next/link'
import { memo, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { CameraIcon, CloseIcon, FilmIcon, ImageIcon, PencilIcon, StarIcon, StarLineIcon, TrashIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { formatDate, getDaysSinceDate, toDateInputValue, type Plant, type TimelineEntry } from '@/lib/garden'
import { getCachedSignedUrl, warmImages } from '@/lib/photos'
import {
  useAddTimelinePhotos,
  useDeleteTimelineEntry,
  useToggleFeatured,
  useUpdateTimelineEntry,
  type UploadProgress,
} from '@/lib/queries'

/** `image/*` → điện thoại mở thẳng thư viện ảnh / camera thay vì trình chọn tệp */
const ACCEPTED_TYPES = 'image/*'
/** Số ảnh đầu tiên tải ưu tiên cao */
const EAGER_COUNT = 2

export function TimelineTab({ plant }: { plant: Plant }) {
  const libraryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const addPhotos = useAddTimelinePhotos(plant.id)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [viewing, setViewing] = useState<TimelineEntry | null>(null)
  const entries = plant.timeline_entries

  // Khi rảnh, tải sẵn ảnh full của vài lá tiếp theo vào HTTP cache → cuộn xuống là có ngay
  useEffect(() => {
    const urls = entries
      .slice(EAGER_COUNT, EAGER_COUNT + 6)
      .map((entry) => getCachedSignedUrl(entry.photo_path))
      .filter((url): url is string => Boolean(url))
    warmImages(urls)
  }, [entries])

  const upload = (files: File[]) => {
    if (files.length === 0 || addPhotos.isPending) {
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

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    upload(files)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    upload(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/')))
  }

  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          setIsDragging(true)
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false)
        }
      }}
      onDrop={handleDrop}
      className="relative"
    >
      {isDragging ? (
        <div className="pointer-events-none absolute -inset-2 z-10 flex items-start justify-center rounded-[2rem] border-2 border-dashed border-primary bg-secondary-container/70 pt-24 backdrop-blur-sm">
          <p className="flex items-center gap-2 font-serif text-xl font-semibold text-primary">
            <ImageIcon /> Thả ảnh để thêm vào nhật ký
          </p>
        </div>
      ) : null}

      <input ref={libraryRef} type="file" accept={ACCEPTED_TYPES} multiple hidden onChange={handleFiles} />
      <input ref={cameraRef} type="file" accept={ACCEPTED_TYPES} capture="environment" hidden onChange={handleFiles} />

      {/* Mobile: 3 nút chia đều 1 hàng; desktop: nút gọn theo nội dung */}
      <div className="mb-6 flex items-center gap-2 sm:gap-3 [&>*]:flex-1 [&>*]:px-3 sm:[&>*]:flex-none sm:[&>*]:px-6">
        {progress ? (
          <span className="btn-primary pointer-events-none !flex-[2] opacity-80">
            Đang tải {progress.done}/{progress.total}…
          </span>
        ) : (
          <>
            {/* Camera chỉ có nghĩa trên thiết bị cảm ứng; desktop `capture` bị bỏ qua → ẩn */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={addPhotos.isPending}
              className="btn-primary hidden pointer-coarse:inline-flex"
            >
              <CameraIcon className="text-lg" /> Chụp lá
            </button>
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              disabled={addPhotos.isPending}
              className="btn-secondary"
            >
              <ImageIcon className="text-lg" /> Albums
            </button>
          </>
        )}
        {entries.length >= 2 ? (
          <Link href={`/plants/${plant.id}/video`} className="btn-secondary">
            <FilmIcon className="text-lg" /> Tạo video
          </Link>
        ) : (
          <span
            className="btn-secondary cursor-not-allowed opacity-50"
            title="Cần ít nhất 2 ảnh lá"
            aria-disabled="true"
          >
            <FilmIcon className="text-lg" /> Tạo video
          </span>
        )}
      </div>

      {progress ? (
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-container to-success-green transition-[width] duration-300"
            style={{ width: `${Math.max(6, (progress.done / progress.total) * 100)}%` }}
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
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-outline-variant bg-surface-container-lowest/60 px-6 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-3xl text-primary">
            <CameraIcon />
          </span>
          <span className="font-serif text-xl font-semibold text-primary">Chưa có dữ liệu sinh trưởng</span>
          <span className="max-w-sm text-sm text-on-surface-variant">
            Chụp lá mới hoặc thêm ảnh có sẵn để bắt đầu nhật ký. Ngày chụp được lấy tự động từ dữ liệu EXIF.
          </span>
        </div>
      ) : (
        <ol className="sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              plantName={plant.name}
              leafNumber={entries.length - index}
              isFirst={index === 0}
              isLast={index === entries.length - 1}
              priority={index < EAGER_COUNT}
              onView={setViewing}
            />
          ))}
        </ol>
      )}

      <PhotoViewer
        // Lấy bản mới nhất từ cache để trạng thái ngôi sao luôn đúng
        entry={viewing ? (entries.find((entry) => entry.id === viewing.id) ?? null) : null}
        plantName={plant.name}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}

const TimelineEntryCard = memo(function TimelineEntryCard({
  entry,
  plantName,
  leafNumber,
  isFirst,
  isLast,
  priority,
  onView,
}: {
  entry: TimelineEntry
  plantName: string
  leafNumber: number
  isFirst: boolean
  isLast: boolean
  priority: boolean
  onView: (entry: TimelineEntry) => void
}) {
  const updateEntry = useUpdateTimelineEntry()
  const deleteEntry = useDeleteTimelineEntry()
  const toggleFeatured = useToggleFeatured()
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
    // Cột trái: chấm + đường kẻ cùng một lưới với thẻ → luôn thẳng hàng
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 sm:block">
      <div className="relative flex justify-center sm:hidden" aria-hidden="true">
        {isFirst && isLast ? null : (
          <span
            className={`absolute w-0.5 bg-gradient-to-b from-primary/30 to-outline-variant/40 ${
              isFirst ? 'top-6 bottom-0' : isLast ? 'top-0 h-6' : 'inset-y-0'
            }`}
          />
        )}
        <span
          className={`relative mt-4 h-4 w-4 rounded-full ring-4 ring-surface ${
            isFirst ? 'bg-primary shadow-[0_0_0_6px_rgba(0,106,70,0.15)]' : 'bg-primary-fixed-dim'
          }`}
        />
      </div>

      <article
        className={`card mb-6 flex h-full flex-col overflow-hidden sm:mb-0 ${isFirst ? 'animate-fade-up' : ''} ${
          deleteEntry.isPending ? 'opacity-50' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onView(entry)}
          className="group relative block w-full shrink-0 cursor-zoom-in"
          aria-label={`Phóng to lá #${leafNumber}`}
        >
          <PlantPhoto
            path={entry.photo_path}
            placeholderPath={entry.thumb_path}
            alt={`${plantName} — lá #${leafNumber}, ${formatDate(entry.taken_at)}`}
            priority={priority}
            className="aspect-[4/5] w-full"
          />
          <span className="pill absolute top-3 left-3 bg-black/45 text-white backdrop-blur">Lá #{leafNumber}</span>
          {entry.featured_at ? (
            <span className="pill absolute top-3 right-3 bg-primary-fixed text-primary shadow">
              <StarIcon className="h-3 w-3" /> Bộ sưu tập
            </span>
          ) : null}
        </button>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xl font-semibold text-on-surface">{formatDate(entry.taken_at)}</p>
              <p className="text-xs text-outline">{daysAgo <= 0 ? 'Hôm nay' : `${daysAgo} ngày trước`}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleFeatured.mutate({ entry, featured: !entry.featured_at })}
              className={`btn-icon ${entry.featured_at ? 'text-[#c98a00]' : 'hover:text-[#c98a00]'}`}
              aria-pressed={Boolean(entry.featured_at)}
              aria-label={entry.featured_at ? 'Gỡ khỏi bộ sưu tập' : 'Lưu vào bộ sưu tập'}
              title={entry.featured_at ? 'Gỡ khỏi bộ sưu tập' : 'Lưu vào bộ sưu tập (ảnh đẹp nhất)'}
            >
              {entry.featured_at ? <StarIcon /> : <StarLineIcon />}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((value) => !value)}
              className="btn-icon"
              aria-label={isEditing ? 'Hủy sửa' : 'Sửa ghi chú'}
              title={isEditing ? 'Hủy' : 'Sửa ghi chú quan sát / ngày chụp'}
            >
              {isEditing ? <CloseIcon /> : <PencilIcon />}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteEntry.isPending}
              className="btn-icon hover:bg-error-container hover:text-error"
              aria-label="Xóa ảnh"
              title="Xóa ảnh"
            >
              <TrashIcon />
            </button>
          </div>
          {toggleFeatured.error ? <p className="mt-2 text-xs text-error">{toggleFeatured.error.message}</p> : null}

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
                <span className="field-label">Ghi chú quan sát</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="field-input resize-y"
                  placeholder="VD: lá non đã mở, var half-moon, mảng trắng ổn định, không cháy mép…"
                />
              </label>
              {updateEntry.error ? <p className="text-sm text-error">{updateEntry.error.message}</p> : null}
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
            <p className="mt-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-on-surface-variant">
              {entry.note}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="mt-3 self-start text-sm text-outline underline-offset-4 hover:text-primary hover:underline"
            >
              + Thêm ghi chú quan sát
            </button>
          )}
        </div>
      </article>
    </li>
  )
})

/** Xem ảnh lá toàn màn hình (giữ trọn ảnh, không cắt). */
function PhotoViewer({
  entry,
  plantName,
  onClose,
}: {
  entry: TimelineEntry | null
  plantName: string
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const toggleFeatured = useToggleFeatured()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (entry && !dialog.open) {
      dialog.showModal()
    } else if (!entry && dialog.open) {
      dialog.close()
    }
  }, [entry])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90 backdrop:backdrop-blur-sm"
      aria-label="Xem ảnh lá"
    >
      {entry ? (
        <div className="flex h-full w-full animate-fade-in flex-col p-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="mb-3 flex items-center gap-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg font-semibold">{plantName}</p>
              <p className="text-xs text-white/70">{formatDate(entry.taken_at)}</p>
              {toggleFeatured.error ? <p className="text-xs text-red-300">{toggleFeatured.error.message}</p> : null}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toggleFeatured.mutate({ entry, featured: !entry.featured_at })
              }}
              aria-pressed={Boolean(entry.featured_at)}
              className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                entry.featured_at ? 'bg-primary-fixed text-primary' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {entry.featured_at ? <StarIcon className="text-[#c98a00]" /> : <StarLineIcon />}
              {entry.featured_at ? 'Đã lưu' : 'Bộ sưu tập'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl hover:bg-white/25"
              aria-label="Đóng"
            >
              <CloseIcon />
            </button>
          </div>
          <PlantPhoto
            path={entry.photo_path}
            placeholderPath={entry.thumb_path}
            alt={`${plantName} — ${formatDate(entry.taken_at)}`}
            fit="contain"
            priority
            className="min-h-0 flex-1 rounded-2xl !bg-transparent"
          />
          {entry.note ? (
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm whitespace-pre-line text-white/85">{entry.note}</p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  )
}
