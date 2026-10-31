'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeftIcon, CameraIcon, CloseIcon, ImageIcon, SearchIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { getDaysSinceDate, getLatestTimelineEntry, getPlantLastPhotoAt, type Plant } from '@/lib/garden'
import { useAddTimelinePhotos, usePlants, type UploadProgress } from '@/lib/queries'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

/** Chụp lá trước, chọn mẫu cây sau — luồng nhanh khi đứng trước kệ cây. */
export function QuickCapture() {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const { data: plants, isPending } = usePlants()
  const addPhotos = useAddTimelinePhotos()
  const [files, setFiles] = useState<File[]>([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [savingPlantId, setSavingPlantId] = useState<string | null>(null)

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  // Cây lâu chưa ghi nhận nhất lên đầu
  const candidates = useMemo(() => {
    const keyword = deferredSearch.trim().toLocaleLowerCase('vi')
    return (plants ?? [])
      .filter((plant) => !plant.is_sold)
      .filter(
        (plant) =>
          !keyword ||
          plant.name.toLocaleLowerCase('vi').includes(keyword) ||
          plant.scientific_name?.toLocaleLowerCase('vi').includes(keyword),
      )
      .sort((left, right) => getPlantLastPhotoAt(left).getTime() - getPlantLastPhotoAt(right).getTime())
  }, [plants, deferredSearch])

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length > 0) {
      setFiles((current) => [...current, ...picked])
    }
  }

  const save = (plant: Plant) => {
    setSavingPlantId(plant.id)
    addPhotos.mutate(
      { files, plantId: plant.id, onProgress: setProgress },
      {
        onSuccess: ({ errors }) => {
          if (errors.length === 0) {
            router.push(`/plants/${plant.id}`)
          }
        },
        onSettled: () => {
          setProgress(null)
          setSavingPlantId(null)
        },
      },
    )
  }

  const isSaving = addPhotos.isPending
  const uploadErrors = addPhotos.data?.errors ?? (addPhotos.error ? [addPhotos.error.message] : [])

  return (
    <div className="animate-fade-in">
      <input ref={cameraRef} type="file" accept={ACCEPTED_TYPES} capture="environment" hidden onChange={handleFiles} />
      <input ref={libraryRef} type="file" accept={ACCEPTED_TYPES} multiple hidden onChange={handleFiles} />

      <Link href="/" className="btn-ghost -ml-3 mb-3">
        <ArrowLeftIcon /> Kho cây
      </Link>
      <p className="eyebrow">Chụp nhanh</p>
      <h1 className="mb-1 font-serif text-3xl font-semibold text-on-surface">Ghi nhận ảnh lá</h1>
      <p className="mb-6 text-sm text-on-surface-variant">
        Chụp lá trước, chọn mẫu cây sau. Ngày chụp được lấy tự động từ dữ liệu EXIF.
      </p>

      {files.length === 0 ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-container via-primary to-[#002f1e] px-6 py-14 text-on-primary shadow-leaf-lg transition-transform active:scale-[0.98]"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-fixed text-4xl text-primary shadow-fab">
              <CameraIcon />
            </span>
            <span className="font-serif text-2xl font-semibold">Mở camera</span>
            <span className="text-sm text-on-primary/70">Chụp lá mới ra hoặc cập nhật sinh trưởng</span>
          </button>
          <button type="button" onClick={() => libraryRef.current?.click()} className="btn-secondary w-full">
            <ImageIcon /> Chọn từ thư viện ảnh
          </button>
        </div>
      ) : (
        <>
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold text-on-surface">{files.length} ảnh đã chọn</h2>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={isSaving}
                className="btn-ghost -mr-2"
              >
                <CameraIcon /> Chụp thêm
              </button>
            </div>
            <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {previews.map((url, index) => (
                <li key={url} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Ảnh ${index + 1}`} className="h-28 w-24 rounded-2xl object-cover shadow-leaf" />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-sm text-white backdrop-blur"
                    aria-label={`Bỏ ảnh ${index + 1}`}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {progress ? (
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-container to-success-green transition-[width] duration-300"
                style={{ width: `${Math.max(6, (progress.done / progress.total) * 100)}%` }}
              />
            </div>
          ) : null}

          {uploadErrors.length > 0 ? (
            <ul className="mb-5 space-y-1 rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
              {uploadErrors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          ) : null}

          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold text-on-surface">Lưu vào mẫu cây</h2>
            <label className="relative mb-4 block">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-outline">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field-input rounded-full pl-11"
                placeholder="Tên cây hoặc tên khoa học…"
                aria-label="Tìm mẫu cây"
              />
            </label>

            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="skeleton h-18 rounded-2xl" />
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">Không có mẫu cây nào khớp.</p>
            ) : (
              <ul className="space-y-2">
                {candidates.map((plant) => {
                  const latest = getLatestTimelineEntry(plant)
                  const days = getDaysSinceDate(getPlantLastPhotoAt(plant))
                  const isThis = savingPlantId === plant.id
                  return (
                    <li key={plant.id}>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => save(plant)}
                        className="card flex w-full items-center gap-3 p-2.5 pr-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
                      >
                        <PlantPhoto
                          path={latest?.thumb_path ?? latest?.photo_path}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-base font-semibold text-on-surface">
                            {plant.name}
                          </span>
                          <span className={`block text-xs ${days >= 14 ? 'text-error' : 'text-on-surface-variant'}`}>
                            {latest ? `Ghi nhận gần nhất: ${days <= 0 ? 'hôm nay' : `${days} ngày trước`}` : 'Chưa ghi nhận'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {isThis && progress ? `${progress.done}/${progress.total}` : 'Lưu'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
